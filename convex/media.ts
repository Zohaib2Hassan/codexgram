import { v } from "convex/values";
import { internalQuery, internalMutation, mutation } from "./_generated/server";
import {
  active,
  blocked,
  controls,
  fail,
  quota,
  user,
  visiblePost,
  visibleUser,
} from "./lib/access";
import { bounded } from "../shared/domain";
import { deleteMedia } from "./social";
export const authorizeUpload = internalMutation({
  args: { operationId: v.string() },
  handler: async (ctx, { operationId }) => {
    const me = await user(ctx);
    bounded(operationId, 100, true);
    const c = await controls(ctx);
    if (c.uploadsPaused || c.estimatedMonthlyUsd >= 25) fail("BUDGET_PAUSED");
    const existing = await ctx.db
      .query("media")
      .withIndex("owner_op", (q) =>
        q.eq("owner", me._id).eq("operationId", operationId),
      )
      .unique();
    if (existing?.state === "deleted") fail("UPLOAD_EXPIRED");
    const reservation = await ctx.db
      .query("uploadReservations")
      .withIndex("owner_op", (q) =>
        q.eq("owner", me._id).eq("operationId", operationId),
      )
      .unique();
    if (!existing && (!reservation || reservation.expiresAt < Date.now())) {
      await quota(ctx, me._id, "upload", 40);
      if (reservation)
        await ctx.db.patch(reservation._id, {
          expiresAt: Date.now() + 3600000,
        });
      else
        await ctx.db.insert("uploadReservations", {
          owner: me._id,
          operationId,
          expiresAt: Date.now() + 3600000,
        });
    }
    return { owner: me._id, existing: existing?._id };
  },
});
export const saveUpload = internalMutation({
  args: {
    operationId: v.string(),
    storageId: v.id("_storage"),
    kind: v.union(v.literal("image"), v.literal("video")),
    mime: v.string(),
    size: v.number(),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const c = await controls(ctx);
    if (c.uploadsPaused || c.estimatedMonthlyUsd >= 25) fail("BUDGET_PAUSED");
    const existing = await ctx.db
      .query("media")
      .withIndex("owner_op", (q) =>
        q.eq("owner", me._id).eq("operationId", args.operationId),
      )
      .unique();
    if (existing) {
      await ctx.storage.delete(args.storageId);
      return existing._id;
    }
    return ctx.db.insert("media", {
      ...args,
      operationId: bounded(args.operationId, 100, true),
      owner: me._id,
      state: "ready",
    });
  },
});
export const access = internalQuery({
  args: { id: v.id("media") },
  handler: async (ctx, { id }) => {
    const me = await user(ctx);
    const c = await controls(ctx);
    if (c.mediaPaused || c.estimatedMonthlyUsd >= 25) fail("MEDIA_PAUSED");
    const m = await ctx.db.get(id);
    if (!m || m.state === "deleted") fail("NOT_FOUND");
    if (m.state === "ready") {
      if (m.owner !== me._id) fail("NOT_FOUND");
      return m;
    }
    if (m.context === "post") {
      const p = m.contextId ? ctx.db.normalizeId("posts", m.contextId) : null;
      if (!p || !(await visiblePost(ctx, me, await ctx.db.get(p))))
        fail("NOT_FOUND");
    } else if (m.context === "message") {
      const id = m.contextId
        ? ctx.db.normalizeId("messages", m.contextId)
        : null;
      const message = id ? await ctx.db.get(id) : null;
      const conversation = message
        ? await ctx.db.get(message.conversationId)
        : null;
      if (
        !message ||
        message.removed ||
        !conversation ||
        (conversation.a !== me._id && conversation.b !== me._id) ||
        (await blocked(ctx, conversation.a, conversation.b))
      )
        fail("NOT_FOUND");
      const owner = await ctx.db.get(m.owner);
      if (!owner || !active(owner)) fail("NOT_FOUND");
    } else if (m.context === "avatar") {
      if (!(await visibleUser(ctx, me, await ctx.db.get(m.owner))))
        fail("NOT_FOUND");
    } else fail("NOT_FOUND");
    return m;
  },
});
export const avatar = mutation({
  args: { mediaId: v.id("media") },
  handler: async (ctx, { mediaId }) => {
    const me = await user(ctx);
    const m = await ctx.db.get(mediaId);
    if (!m || m.owner !== me._id || m.state !== "ready" || m.kind !== "image")
      fail("INVALID_MEDIA");
    if (me.avatarId) await deleteMedia(ctx, me.avatarId);
    await ctx.db.patch(mediaId, {
      state: "published",
      context: "avatar",
      contextId: me._id,
    });
    await ctx.db.patch(me._id, { avatarId: mediaId });
  },
});
