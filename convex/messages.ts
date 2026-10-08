import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import {
  blocked,
  canSend,
  controls,
  fail,
  publicUser,
  quota,
  user,
  visiblePost,
} from "./lib/access";
import { bounded, LIMITS } from "../shared/domain";
import { notify } from "./lib/notifications";

export const start = mutation({
  args: { otherId: v.id("users") },
  handler: async (ctx, { otherId }) => {
    const me = await user(ctx);
    if (!(await canSend(ctx, me, await ctx.db.get(otherId))))
      fail("MUTUAL_SAME_AGE_REQUIRED");
    const [a, b] = [me._id, otherId].sort();
    const key = `${a}:${b}`;
    const old = await ctx.db
      .query("conversations")
      .withIndex("key", (q) => q.eq("key", key))
      .unique();
    return (
      old?._id ??
      ctx.db.insert("conversations", {
        a,
        b,
        key,
        lastAt: Date.now(),
        readA: 0,
        readB: 0,
        sequence: 0,
      })
    );
  },
});
export const inbox = query({
  args: {},
  handler: async (ctx) => {
    const me = await user(ctx);
    const rows = [
      ...(await ctx.db
        .query("conversations")
        .withIndex("a", (q) => q.eq("a", me._id))
        .order("desc")
        .take(100)),
      ...(await ctx.db
        .query("conversations")
        .withIndex("b", (q) => q.eq("b", me._id))
        .order("desc")
        .take(100)),
    ];
    const result = [];
    for (const c of rows) {
      const other = await ctx.db.get(c.a === me._id ? c.b : c.a);
      if (await blocked(ctx, me._id, c.a === me._id ? c.b : c.a)) continue;
      const last = await ctx.db
        .query("messages")
        .withIndex("conversation", (q) => q.eq("conversationId", c._id))
        .order("desc")
        .first();
      result.push({
        ...c,
        other:
          other && other.status !== "deleted"
            ? {
                _id: other._id,
                displayName: other.displayName,
                username: other.username,
              }
            : null,
        unread:
          !!last &&
          last.author !== me._id &&
          last.sequence > (c.a === me._id ? c.readA : c.readB),
        writable: await canSend(ctx, me, other),
      });
    }
    return result.sort((a, b) => b.lastAt - a.lastAt);
  },
});
export const info = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    const me = await user(ctx);
    const c = await ctx.db.get(id);
    if (
      !c ||
      (c.a !== me._id && c.b !== me._id) ||
      (await blocked(ctx, c.a, c.b))
    )
      return null;
    const other = await ctx.db.get(c.a === me._id ? c.b : c.a);
    return {
      ...c,
      other:
        other && other.status !== "deleted"
          ? { _id: other._id, displayName: other.displayName }
          : null,
      writable: await canSend(ctx, me, other),
      otherRead: c.a === me._id ? c.readB : c.readA,
    };
  },
});
export const list = query({
  args: { id: v.id("conversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const c = await ctx.db.get(args.id);
    if (
      !c ||
      (c.a !== me._id && c.b !== me._id) ||
      (await blocked(ctx, c.a, c.b))
    )
      fail("NOT_FOUND");
    const result = await ctx.db
      .query("messages")
      .withIndex("conversation", (q) => q.eq("conversationId", c._id))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, 40),
      });
    const page = [];
    for (const m of result.page) {
      const author = await ctx.db.get(m.author);
      const media = m.mediaId ? await ctx.db.get(m.mediaId) : null;
      const post = m.postId ? await ctx.db.get(m.postId) : null;
      page.push({
        ...m,
        text: m.removed ? "" : m.text,
        authorName:
          author?.status === "deleted" ? "Deleted user" : author?.displayName,
        media:
          media?.state === "published" && !m.removed
            ? { _id: media._id, kind: media.kind }
            : null,
        post:
          post && !m.removed && (await visiblePost(ctx, me, post))
            ? { _id: post._id, caption: post.caption }
            : null,
      });
    }
    return { ...result, page };
  },
});
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
    mediaId: v.optional(v.id("media")),
    postId: v.optional(v.id("posts")),
    operationId: v.string(),
    expectedUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    if (args.expectedUserId !== me._id) fail("SESSION_MISMATCH");
    const old = await ctx.db
      .query("messages")
      .withIndex("author_op", (q) =>
        q.eq("author", me._id).eq("operationId", args.operationId),
      )
      .unique();
    if (old) return old._id;
    const c = await ctx.db.get(args.conversationId);
    if (!c || (c.a !== me._id && c.b !== me._id)) fail("NOT_FOUND");
    const otherId = c.a === me._id ? c.b : c.a;
    const other = await ctx.db.get(otherId);
    if (!(await canSend(ctx, me, other))) fail("CHAT_READ_ONLY");
    const text = bounded(args.text, 4000);
    if (
      (!text && !args.mediaId && !args.postId) ||
      (args.mediaId && args.postId)
    )
      fail("INVALID_MESSAGE");
    await quota(ctx, me._id, "message", 1000);
    if (args.postId) {
      const p = await ctx.db.get(args.postId);
      if (
        !(await visiblePost(ctx, me, p)) ||
        !other ||
        !(await visiblePost(ctx, other, p))
      )
        fail("POST_UNAVAILABLE");
    }
    const media = args.mediaId ? await ctx.db.get(args.mediaId) : null;
    if (args.mediaId) {
      if ((await controls(ctx)).uploadsPaused) fail("BUDGET_PAUSED");
      if (!media || media.owner !== me._id || media.state !== "ready")
        fail("INVALID_MEDIA");
      await quota(ctx, me._id, "dm_media", LIMITS.dmMediaPerDay);
    }
    const sequence = c.sequence + 1;
    const id = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      text,
      mediaId: args.mediaId,
      postId: args.postId,
      operationId: bounded(args.operationId, 100, true),
      author: me._id,
      sequence,
      removed: false,
    });
    if (media)
      await ctx.db.patch(media._id, {
        state: "published",
        context: "message",
        contextId: id,
      });
    await ctx.db.patch(c._id, {
      sequence,
      lastAt: Date.now(),
      ...(c.a === me._id ? { readA: sequence } : { readB: sequence }),
    });
    await notify(ctx, me, otherId, "dm", { kind: "message", id });
    return id;
  },
});
export const read = mutation({
  args: { id: v.id("conversations"), sequence: v.number() },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const c = await ctx.db.get(args.id);
    if (
      !c ||
      (c.a !== me._id && c.b !== me._id) ||
      (await blocked(ctx, c.a, c.b))
    )
      fail("NOT_FOUND");
    const seq = Math.min(c.sequence, Math.max(0, Math.floor(args.sequence)));
    await ctx.db.patch(
      c._id,
      c.a === me._id
        ? { readA: Math.max(c.readA, seq) }
        : { readB: Math.max(c.readB, seq) },
    );
  },
});
