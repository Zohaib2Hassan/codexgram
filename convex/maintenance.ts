import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { user } from "./lib/access";
import { cohort } from "../shared/domain";
import { deleteMedia } from "./social";
export const deleteAccount = mutation({
  args: { confirmation: v.literal("DELETE") },
  handler: async (ctx) => {
    const me = await user(ctx, true);
    await ctx.db.patch(me._id, {
      status: "deleted",
      displayName: "Deleted user",
      username: `deleted_${me._id}`,
      bio: "",
      website: "",
      location: "",
      birthDate: "1900-01-01",
      avatarId: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.maintenance.purgeUser, {
      id: me._id,
    });
    await ctx.scheduler.runAfter(0, internal.maintenance.deleteIdentity, {
      clerkId: me.clerkId,
      attempt: 0,
    });
  },
});
export const deleteIdentity = internalAction({
  args: { clerkId: v.string(), attempt: v.number() },
  handler: async (ctx, args) => {
    if (!process.env.CLERK_SECRET_KEY) {
      console.error("identity_deletion_configuration_missing");
      return;
    }
    try {
      const response = await fetch(
        `https://api.clerk.com/v1/users/${encodeURIComponent(args.clerkId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        },
      );
      if (!response.ok && response.status !== 404) throw new Error("RETRY");
    } catch {
      if (args.attempt < 8)
        await ctx.scheduler.runAfter(
          Math.min(3600000, 60000 * 2 ** args.attempt),
          internal.maintenance.deleteIdentity,
          { ...args, attempt: args.attempt + 1 },
        );
      else console.error("identity_deletion_failed");
    }
  },
});
export const purgeUser = internalMutation({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    // Bounded batches keep deletion below transaction limits. Tombstone denies access immediately.
    const media = await ctx.db
      .query("media")
      .withIndex("owner", (q) => q.eq("owner", id))
      .filter((q) => q.neq(q.field("state"), "deleted"))
      .take(25);
    for (const m of media) await deleteMedia(ctx, m._id);
    const posts = await ctx.db
      .query("posts")
      .withIndex("author", (q) => q.eq("author", id))
      .filter((q) => q.neq(q.field("deletedByOwner"), true))
      .take(100);
    for (const p of posts)
      await ctx.db.patch(p._id, {
        deleted: true,
        deletedByOwner: true,
        caption: "",
      });
    const comments = await ctx.db
      .query("comments")
      .withIndex("author", (q) => q.eq("author", id))
      .filter((q) => q.neq(q.field("deletedByOwner"), true))
      .take(100);
    for (const c of comments)
      await ctx.db.patch(c._id, {
        deleted: true,
        deletedByOwner: true,
        text: "",
      });
    let deleted = 0;
    for (const table of ["follows", "blocks", "mutes"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("pair", (q) => q.eq("from", id))
        .take(100);
      for (const r of rows) await ctx.db.delete(r._id);
      deleted += rows.length;
    }
    for (const table of ["follows", "blocks"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("to", (q) => q.eq("to", id))
        .take(100);
      for (const r of rows) await ctx.db.delete(r._id);
      deleted += rows.length;
    }
    for (const table of ["likes", "bookmarks"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("pair", (q) => q.eq("userId", id))
        .take(100);
      for (const r of rows) await ctx.db.delete(r._id);
      deleted += rows.length;
    }
    for (const d of await ctx.db
      .query("devices")
      .withIndex("user", (q) => q.eq("userId", id))
      .collect())
      await ctx.db.delete(d._id);
    const notices = await ctx.db
      .query("notifications")
      .withIndex("recipient", (q) => q.eq("recipient", id))
      .take(100);
    for (const n of notices) await ctx.db.delete(n._id);
    if (
      media.length ||
      posts.length ||
      comments.length ||
      deleted ||
      notices.length
    )
      await ctx.scheduler.runAfter(0, internal.maintenance.purgeUser, { id });
  },
});
export const hourly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const people = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("status"), "deleted"))
      .take(501);
    for (const p of people) {
      if (p.status === "deleted") continue;
      if (
        p.status === "suspended" &&
        p.suspensionUntil !== undefined &&
        p.suspensionUntil <= Date.now()
      )
        await ctx.db.patch(p._id, {
          status: "active",
          suspensionUntil: undefined,
          suspensionReason: undefined,
        });
      if (cohort(p.birthDate) === "adult" && !p.processedAdult) {
        await ctx.scheduler.runAfter(0, internal.maintenance.transition, {
          id: p._id,
        });
      }
    }
    const abandoned = await ctx.db
      .query("media")
      .filter((q) =>
        q.and(
          q.eq(q.field("state"), "ready"),
          q.lt(q.field("_creationTime"), Date.now() - 86400000),
        ),
      )
      .take(100);
    for (const m of abandoned) await deleteMedia(ctx, m._id);
    const closed = await ctx.db
      .query("reports")
      .withIndex("status", (q) => q.eq("status", "closed"))
      .filter((q) =>
        q.and(
          q.lt(q.field("closedAt"), Date.now() - 30 * 86400000),
          q.or(
            q.neq(q.field("evidenceText"), ""),
            q.neq(q.field("evidenceStorageId"), undefined),
          ),
        ),
      )
      .take(100);
    for (const r of closed) {
      const actions = await ctx.db
        .query("moderation")
        .withIndex("subject", (q) => q.eq("subject", r.subject))
        .collect();
      const open = await ctx.db
        .query("appeals")
        .withIndex("user", (q) => q.eq("userId", r.subject))
        .collect();
      if (
        open.some(
          (a) =>
            a.status === "open" &&
            actions.some(
              (m) => m._id === a.moderationId && m.reportId === r._id,
            ),
        )
      )
        continue;
      if (r.evidenceStorageId) await ctx.storage.delete(r.evidenceStorageId);
      if (r.target.kind === "post") {
        const id = ctx.db.normalizeId("posts", r.target.id);
        const p = id ? await ctx.db.get(id) : null;
        if (p?.deleted) await ctx.db.patch(p._id, { caption: "" });
      }
      if (r.target.kind === "comment") {
        const id = ctx.db.normalizeId("comments", r.target.id);
        const c = id ? await ctx.db.get(id) : null;
        if (c?.deleted) await ctx.db.patch(c._id, { text: "" });
      }
      if (r.target.kind === "message") {
        const id = ctx.db.normalizeId("messages", r.target.id);
        const m = id ? await ctx.db.get(id) : null;
        if (m?.removed) await ctx.db.patch(m._id, { text: "" });
      }
      await ctx.db.patch(r._id, {
        evidenceText: "",
        evidenceStorageId: undefined,
        evidenceMime: undefined,
      });
    }
    for (const reservation of await ctx.db
      .query("uploadReservations")
      .filter((q) => q.lt(q.field("expiresAt"), Date.now() - 86400000))
      .take(100))
      await ctx.db.delete(reservation._id);
  },
});
export const transition = internalMutation({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    const p = await ctx.db.get(id);
    if (!p || p.status === "deleted" || cohort(p.birthDate) !== "adult") return;
    const posts = await ctx.db
      .query("posts")
      .withIndex("author", (q) => q.eq("author", id))
      .filter((q) =>
        q.and(
          q.eq(q.field("publishedCohort"), "teen"),
          q.eq(q.field("archived"), false),
        ),
      )
      .take(100);
    for (const post of posts) await ctx.db.patch(post._id, { archived: true });
    for (const f of [
      ...(await ctx.db
        .query("follows")
        .withIndex("pair", (q) => q.eq("from", id))
        .collect()),
      ...(await ctx.db
        .query("follows")
        .withIndex("to", (q) => q.eq("to", id))
        .collect()),
    ]) {
      const other = await ctx.db.get(f.from === id ? f.to : f.from);
      if (!other || cohort(other.birthDate) !== "adult")
        await ctx.db.delete(f._id);
    }
    if (posts.length === 100)
      await ctx.scheduler.runAfter(0, internal.maintenance.transition, { id });
    else await ctx.db.patch(id, { processedAdult: true });
  },
});
