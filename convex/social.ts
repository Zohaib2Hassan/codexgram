import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  controls,
  fail,
  publicUser,
  quota,
  user,
  visiblePost,
  visibleUser,
  blocked,
} from "./lib/access";
import { bounded, cohort, LIMITS, mentionedNames } from "../shared/domain";
import { notify, mentions } from "./lib/notifications";

export async function postView(
  ctx: QueryCtx | MutationCtx,
  me: Doc<"users">,
  p: Doc<"posts">,
) {
  const author = await ctx.db.get(p.author);
  const media = await ctx.db.get(p.mediaId);
  const likes = await ctx.db
    .query("likes")
    .withIndex("post", (q) => q.eq("postId", p._id))
    .collect();
  return {
    ...p,
    authorProfile: author ? publicUser(author) : null,
    media: media ? { _id: media._id, kind: media.kind } : null,
    likeCount: likes.length,
    liked: likes.some((l) => l.userId === me._id),
    saved: !!(await ctx.db
      .query("bookmarks")
      .withIndex("pair", (q) => q.eq("userId", me._id).eq("postId", p._id))
      .unique()),
  };
}
export const feed = query({
  args: {
    mode: v.union(
      v.literal("home"),
      v.literal("explore"),
      v.literal("profile"),
      v.literal("saved"),
    ),
    author: v.optional(v.id("users")),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const term = bounded(args.search ?? "", 100);
    const source =
      args.mode === "profile" && args.author
        ? ctx.db
            .query("posts")
            .withIndex("author", (q) => q.eq("author", args.author!))
            .order("desc")
        : term
          ? ctx.db
              .query("posts")
              .withSearchIndex("captions", (q) => q.search("caption", term))
          : ctx.db.query("posts").order("desc");
    const result = await source.paginate({
      ...args.paginationOpts,
      numItems: Math.min(args.paginationOpts.numItems, 30),
    });
    const page = [];
    for (const p of result.page) {
      if (!(await visiblePost(ctx, me, p))) continue;
      if (
        args.mode !== "profile" &&
        (p.archived || p.publishedCohort !== cohort(me.birthDate))
      )
        continue;
      if (
        args.mode === "home" &&
        p.author !== me._id &&
        !(await ctx.db
          .query("follows")
          .withIndex("pair", (q) => q.eq("from", me._id).eq("to", p.author))
          .unique())
      )
        continue;
      if (
        (args.mode === "home" || args.mode === "explore") &&
        (await ctx.db
          .query("mutes")
          .withIndex("pair", (q) => q.eq("from", me._id).eq("to", p.author))
          .unique())
      )
        continue;
      if (
        args.mode === "saved" &&
        !(await ctx.db
          .query("bookmarks")
          .withIndex("pair", (q) => q.eq("userId", me._id).eq("postId", p._id))
          .unique())
      )
        continue;
      page.push(await postView(ctx, me, p));
    }
    return { ...result, page };
  },
});
export const post = query({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => {
    const me = await user(ctx);
    const p = await ctx.db.get(id);
    return p && (await visiblePost(ctx, me, p)) ? postView(ctx, me, p) : null;
  },
});
export const saved = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const result = await ctx.db
      .query("bookmarks")
      .withIndex("pair", (q) => q.eq("userId", me._id))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, 20),
      });
    const page = [];
    for (const row of result.page) {
      const post = await ctx.db.get(row.postId);
      page.push({
        id: row._id,
        postId: row.postId,
        post:
          post && (await visiblePost(ctx, me, post))
            ? await postView(ctx, me, post)
            : null,
      });
    }
    return { ...result, page };
  },
});
export const publish = mutation({
  args: {
    mediaId: v.id("media"),
    caption: v.string(),
    operationId: v.string(),
    expectedUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    if (args.expectedUserId !== me._id) fail("SESSION_MISMATCH");
    const old = await ctx.db
      .query("posts")
      .withIndex("author_op", (q) =>
        q.eq("author", me._id).eq("operationId", args.operationId),
      )
      .unique();
    if (old) return old._id;
    if ((await controls(ctx)).uploadsPaused) fail("BUDGET_PAUSED");
    const media = await ctx.db.get(args.mediaId);
    if (!media || media.owner !== me._id || media.state !== "ready")
      fail("INVALID_MEDIA");
    await quota(ctx, me._id, "post", LIMITS.postsPerDay);
    const caption = bounded(args.caption, 2200);
    const id = await ctx.db.insert("posts", {
      author: me._id,
      mediaId: media._id,
      caption,
      operationId: bounded(args.operationId, 100, true),
      publishedCohort: cohort(me.birthDate),
      archived: false,
      deleted: false,
    });
    await ctx.db.patch(media._id, {
      state: "published",
      context: "post",
      contextId: id,
    });
    await mentions(ctx, me, caption, { kind: "post", id });
    return id;
  },
});
export async function deleteMedia(ctx: MutationCtx, id: Id<"media">) {
  const media = await ctx.db.get(id);
  if (media && media.state !== "deleted") {
    await ctx.storage.delete(media.storageId);
    await ctx.db.patch(id, { state: "deleted" });
  }
}
export const editPost = mutation({
  args: { id: v.id("posts"), caption: v.string() },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const p = await ctx.db.get(args.id);
    if (!p || p.author !== me._id || p.deleted) fail("NOT_FOUND");
    const caption = bounded(args.caption, 2200);
    await ctx.db.patch(p._id, { caption });
    if (
      (await visiblePost(ctx, me, p)) &&
      !p.archived &&
      p.publishedCohort === cohort(me.birthDate)
    )
      await mentions(
        ctx,
        me,
        caption,
        { kind: "post", id: p._id },
        mentionedNames(p.caption),
      );
  },
});
export const deletePost = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => {
    const me = await user(ctx);
    const p = await ctx.db.get(id);
    if (!p || p.author !== me._id) fail("NOT_FOUND");
    await ctx.db.patch(id, {
      deleted: true,
      deletedByOwner: true,
      caption: "",
    });
    await deleteMedia(ctx, p.mediaId);
  },
});
export const follow = mutation({
  args: { id: v.id("users"), enabled: v.boolean() },
  handler: async (ctx, { id, enabled }) => {
    const me = await user(ctx);
    const other = await ctx.db.get(id);
    const row = await ctx.db
      .query("follows")
      .withIndex("pair", (q) => q.eq("from", me._id).eq("to", id))
      .unique();
    if (!enabled) {
      if (row) await ctx.db.delete(row._id);
      return;
    }
    if (id === me._id || !(await visibleUser(ctx, me, other)))
      fail("NOT_FOUND");
    if (!row) {
      await quota(ctx, me._id, "follow", 100);
      await ctx.db.insert("follows", { from: me._id, to: id });
      await notify(ctx, me, id, "follow", { kind: "user", id: me._id });
    }
  },
});
export const toggle = mutation({
  args: {
    id: v.id("posts"),
    kind: v.union(v.literal("like"), v.literal("bookmark")),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const p = await ctx.db.get(args.id);
    const table = args.kind === "like" ? "likes" : "bookmarks";
    const old = await ctx.db
      .query(table)
      .withIndex("pair", (q) => q.eq("userId", me._id).eq("postId", args.id))
      .unique();
    if (!args.enabled) {
      if (old) await ctx.db.delete(old._id);
      return;
    }
    if (!p || !(await visiblePost(ctx, me, p))) fail("NOT_FOUND");
    if (!old) {
      await quota(ctx, me._id, args.kind, 500);
      await ctx.db.insert(table, { userId: me._id, postId: p._id });
      if (args.kind === "like")
        await notify(ctx, me, p.author, "like", { kind: "post", id: p._id });
    }
  },
});
export const comments = query({
  args: { id: v.id("posts"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    if (!(await visiblePost(ctx, me, await ctx.db.get(args.id))))
      fail("NOT_FOUND");
    const result = await ctx.db
      .query("comments")
      .withIndex("post", (q) => q.eq("postId", args.id))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, 30),
      });
    const page = [];
    for (const c of result.page) {
      const a = await ctx.db.get(c.author);
      if (!c.deleted && a && (await visibleUser(ctx, me, a)))
        page.push({ ...c, authorProfile: publicUser(a) });
    }
    return { ...result, page };
  },
});
export const comment = mutation({
  args: {
    postId: v.id("posts"),
    text: v.string(),
    id: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const p = await ctx.db.get(args.postId);
    if (
      !p ||
      !(await visiblePost(ctx, me, p)) ||
      p.archived ||
      p.publishedCohort !== cohort(me.birthDate)
    )
      fail("NOT_FOUND");
    const text = bounded(args.text, 1000, true);
    await quota(ctx, me._id, "comment", 100);
    if (args.id) {
      const old = await ctx.db.get(args.id);
      if (!old || old.author !== me._id || old.postId !== p._id || old.deleted)
        fail("NOT_FOUND");
      await ctx.db.patch(old._id, { text });
      await mentions(
        ctx,
        me,
        text,
        { kind: "post", id: p._id },
        mentionedNames(old.text),
      );
      return old._id;
    }
    const id = await ctx.db.insert("comments", {
      postId: p._id,
      author: me._id,
      text,
      deleted: false,
    });
    await notify(ctx, me, p.author, "comment", { kind: "post", id: p._id });
    await mentions(ctx, me, text, { kind: "post", id: p._id });
    return id;
  },
});
export const deleteComment = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, { id }) => {
    const me = await user(ctx);
    const c = await ctx.db.get(id);
    if (!c || c.author !== me._id) fail("NOT_FOUND");
    await ctx.db.patch(id, { deleted: true, deletedByOwner: true, text: "" });
  },
});
export const relationship = mutation({
  args: {
    id: v.id("users"),
    kind: v.union(v.literal("block"), v.literal("mute")),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    if (args.id === me._id) fail("INVALID_TARGET");
    const table = args.kind === "block" ? "blocks" : "mutes";
    const row = await ctx.db
      .query(table)
      .withIndex("pair", (q) => q.eq("from", me._id).eq("to", args.id))
      .unique();
    if (!args.enabled) {
      if (row) await ctx.db.delete(row._id);
      return;
    }
    if (
      !(await visibleUser(ctx, me, await ctx.db.get(args.id))) &&
      !(await blocked(ctx, me._id, args.id))
    )
      fail("NOT_FOUND");
    if (!row) await ctx.db.insert(table, { from: me._id, to: args.id });
    if (args.kind === "block")
      for (const [from, to] of [
        [me._id, args.id],
        [args.id, me._id],
      ]) {
        const f = await ctx.db
          .query("follows")
          .withIndex("pair", (q) => q.eq("from", from).eq("to", to))
          .unique();
        if (f) await ctx.db.delete(f._id);
      }
  },
});
export const hiddenPeople = query({
  args: {},
  handler: async (ctx) => {
    const me = await user(ctx);
    const result = [];
    for (const kind of ["blocks", "mutes"] as const)
      for (const row of await ctx.db
        .query(kind)
        .withIndex("pair", (q) => q.eq("from", me._id))
        .collect()) {
        const p = await ctx.db.get(row.to);
        if (p)
          result.push({
            id: row.to,
            username: p.username,
            kind: kind === "blocks" ? ("block" as const) : ("mute" as const),
          });
      }
    return result;
  },
});
