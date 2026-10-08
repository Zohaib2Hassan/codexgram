import { v } from "convex/values";
import {
  action,
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { target } from "./schema";
import {
  admin,
  blocked,
  controls,
  digest,
  fail,
  publicUser,
  quota,
  user,
  visiblePost,
  visibleUser,
} from "./lib/access";
import { bounded, cohort } from "../shared/domain";
import { deleteMedia } from "./social";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

async function mayReview(
  ctx: QueryCtx | MutationCtx,
  me: Doc<"users">,
  report: Doc<"reports">,
) {
  if (report.subject === me._id || report.reporter === me._id) return false;
  if (me.role === "admin") return true;
  const subject = await ctx.db.get(report.subject);
  const reporter = await ctx.db.get(report.reporter);
  if (subject?.role === "admin" || reporter?.role === "admin") return true;
  const cases = await ctx.db
    .query("moderation")
    .withIndex("subject", (q) => q.eq("subject", report.subject))
    .collect();
  const appeals = await ctx.db
    .query("appeals")
    .withIndex("user", (q) => q.eq("userId", report.subject))
    .collect();
  return appeals.some(
    (a) =>
      a.status === "open" &&
      cases.some(
        (m) =>
          m._id === a.moderationId &&
          m.reportId === report._id &&
          m.actor !== me._id,
      ),
  );
}

export const bootstrap = internalMutation({
  args: {
    clerkId: v.string(),
    role: v.union(v.literal("admin"), v.literal("reviewer")),
    birthDate: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    // Accessible only via deployment owner tooling. No client role assignment endpoint.
    if (process.env.ADMIN_BOOTSTRAP_ENABLED !== "true")
      fail("BOOTSTRAP_DISABLED");
    cohort(args.birthDate);
    if (cohort(args.birthDate) !== "adult") fail("ADULT_ADMIN_REQUIRED");
    const existing = await ctx.db
      .query("users")
      .withIndex("clerk", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!existing) fail("ONBOARD_FIRST");
    if (cohort(existing.birthDate) !== "adult") fail("ADULT_ADMIN_REQUIRED");
    await ctx.db.patch(existing._id, { role: args.role });
  },
});
export const seedInvite = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    if (process.env.ADMIN_BOOTSTRAP_ENABLED !== "true")
      fail("BOOTSTRAP_DISABLED");
    if (code.length < 24) fail("STRONG_CODE_REQUIRED");
    const hash = await digest(code);
    if (
      !(await ctx.db
        .query("invitations")
        .withIndex("digest", (q) => q.eq("digest", hash))
        .unique())
    )
      await ctx.db.insert("invitations", {
        digest: hash,
        createdBy: "bootstrap",
        expiresAt: Date.now() + 7 * 86400000,
        revoked: false,
      });
  },
});
export const createInvite = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const me = await admin(ctx, false);
    if (code.length < 24 || code.length > 100) fail("STRONG_CODE_REQUIRED");
    const c = await controls(ctx);
    if (c.invitationsPaused || c.estimatedMonthlyUsd >= 20)
      fail("INVITATIONS_PAUSED");
    const hash = await digest(code);
    if (
      await ctx.db
        .query("invitations")
        .withIndex("digest", (q) => q.eq("digest", hash))
        .unique()
    )
      fail("DUPLICATE_CODE");
    return ctx.db.insert("invitations", {
      digest: hash,
      createdBy: me._id,
      expiresAt: Date.now() + 7 * 86400000,
      revoked: false,
    });
  },
});
export const revokeInvite = mutation({
  args: { id: v.id("invitations") },
  handler: async (ctx, { id }) => {
    await admin(ctx, false);
    await ctx.db.patch(id, { revoked: true });
  },
});
export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const me = await admin(ctx);
    const reports = [];
    for (const report of await ctx.db.query("reports").order("desc").take(200))
      if (await mayReview(ctx, me, report)) reports.push(report);
    const appeals = [];
    for (const a of await ctx.db.query("appeals").order("desc").take(200)) {
      const m = await ctx.db.get(a.moderationId);
      if (m && m.actor !== me._id && a.userId !== me._id)
        appeals.push({ ...a, action: m });
    }
    return {
      role: me.role,
      reports,
      appeals,
      controls: await controls(ctx),
      invitations:
        me.role === "admin"
          ? await ctx.db.query("invitations").order("desc").take(100)
          : [],
      corrections:
        me.role === "admin"
          ? (await ctx.db.query("corrections").order("desc").take(100)).filter(
              (c) => c.userId !== me._id,
            )
          : [],
    };
  },
});
export const setControls = mutation({
  args: {
    invitationsPaused: v.boolean(),
    uploadsPaused: v.boolean(),
    mediaPaused: v.boolean(),
    estimatedMonthlyUsd: v.number(),
    userCap: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await admin(ctx, false);
    if (
      !Number.isFinite(args.estimatedMonthlyUsd) ||
      args.estimatedMonthlyUsd < 0 ||
      !Number.isInteger(args.userCap) ||
      args.userCap < 1 ||
      args.userCap > 500
    )
      fail("INVALID_LIMIT");
    const old = await ctx.db
      .query("controls")
      .withIndex("key", (q) => q.eq("key", "global"))
      .unique();
    const fields = {
      ...args,
      invitationsPaused:
        args.invitationsPaused || args.estimatedMonthlyUsd >= 20,
      uploadsPaused: args.uploadsPaused || args.estimatedMonthlyUsd >= 25,
      mediaPaused: args.mediaPaused || args.estimatedMonthlyUsd >= 25,
    };
    if (old) await ctx.db.patch(old._id, fields);
    else await ctx.db.insert("controls", { key: "global", ...fields });
    await ctx.db.insert("moderation", {
      actor: me._id,
      subject: me._id,
      action: "controls",
      reason: JSON.stringify(fields),
    });
  },
});
export const reportSnapshot = internalQuery({
  args: { target },
  handler: async (ctx, { target }) => {
    const me = await user(ctx);
    let subject: Id<"users">;
    let text = "";
    let mediaId: Id<"media"> | undefined;
    if (target.kind === "post") {
      const id = ctx.db.normalizeId("posts", target.id);
      const p = id ? await ctx.db.get(id) : null;
      if (!p || !(await visiblePost(ctx, me, p))) fail("NOT_FOUND");
      subject = p.author;
      text = p.caption;
      mediaId = p.mediaId;
    } else if (target.kind === "comment") {
      const id = ctx.db.normalizeId("comments", target.id);
      const c = id ? await ctx.db.get(id) : null;
      if (
        !c ||
        c.deleted ||
        !(await visiblePost(ctx, me, await ctx.db.get(c.postId))) ||
        !(await visibleUser(ctx, me, await ctx.db.get(c.author)))
      )
        fail("NOT_FOUND");
      subject = c.author;
      text = c.text;
    } else if (target.kind === "message") {
      const id = ctx.db.normalizeId("messages", target.id);
      const m = id ? await ctx.db.get(id) : null;
      const c = m ? await ctx.db.get(m.conversationId) : null;
      if (!m || m.removed || !c || (c.a !== me._id && c.b !== me._id))
        fail("NOT_FOUND");
      subject = m.author;
      text = m.text;
      mediaId = m.mediaId;
    } else {
      const id = ctx.db.normalizeId("users", target.id);
      const p = id ? await ctx.db.get(id) : null;
      if (!p || !(await visibleUser(ctx, me, p))) fail("NOT_FOUND");
      subject = p._id;
      text = JSON.stringify(publicUser(p));
      mediaId = p.avatarId;
    }
    if (subject === me._id) fail("INVALID_TARGET");
    const media = mediaId ? await ctx.db.get(mediaId) : null;
    return {
      reporter: me._id,
      subject,
      evidenceText: text,
      storageId:
        media && media.state !== "deleted" ? media.storageId : undefined,
      mime: media?.mime,
    };
  },
});
export const storeReport = internalMutation({
  args: {
    target,
    reason: v.string(),
    subject: v.id("users"),
    evidenceText: v.string(),
    evidenceStorageId: v.optional(v.id("_storage")),
    evidenceMime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    await quota(ctx, me._id, "report", 10);
    return ctx.db.insert("reports", {
      ...args,
      reporter: me._id,
      reason: bounded(args.reason, 1000, true),
      status: "open",
    });
  },
});
export const report = action({
  args: { target, reason: v.string() },
  handler: async (ctx, args): Promise<Id<"reports">> => {
    const snapshot = await ctx.runQuery(internal.admin.reportSnapshot, {
      target: args.target,
    });
    let copy: Id<"_storage"> | undefined;
    try {
      if (snapshot.storageId) {
        const blob = await ctx.storage.get(snapshot.storageId);
        if (blob) copy = await ctx.storage.store(blob);
      }
      return await ctx.runMutation(internal.admin.storeReport, {
        ...args,
        subject: snapshot.subject,
        evidenceText: snapshot.evidenceText,
        evidenceStorageId: copy,
        evidenceMime: snapshot.mime,
      });
    } catch (e) {
      if (copy) await ctx.storage.delete(copy);
      throw e;
    }
  },
});
export const review = mutation({
  args: {
    id: v.id("reports"),
    decision: v.union(
      v.literal("dismiss"),
      v.literal("remove"),
      v.literal("suspend"),
    ),
    reason: v.string(),
    suspensionUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await admin(ctx);
    const r = await ctx.db.get(args.id);
    if (
      !r ||
      r.subject === me._id ||
      r.reporter === me._id ||
      r.status !== "open"
    )
      fail("REVIEW_CONFLICT");
    if (!(await mayReview(ctx, me, r))) fail("REVIEW_CONFLICT");
    const reason = bounded(args.reason, 1000, true);
    if (args.decision === "remove") {
      if (r.target.kind === "post") {
        const id = ctx.db.normalizeId("posts", r.target.id);
        const p = id ? await ctx.db.get(id) : null;
        if (p) {
          await ctx.db.patch(p._id, { deleted: true });
          await deleteMedia(ctx, p.mediaId);
        }
      } else if (r.target.kind === "comment") {
        const id = ctx.db.normalizeId("comments", r.target.id);
        if (id && (await ctx.db.get(id)))
          await ctx.db.patch(id, { deleted: true });
      } else if (r.target.kind === "message") {
        const id = ctx.db.normalizeId("messages", r.target.id);
        const m = id ? await ctx.db.get(id) : null;
        if (m) {
          await ctx.db.patch(m._id, { removed: true });
          if (m.mediaId) await deleteMedia(ctx, m.mediaId);
        }
      } else fail("USE_SUSPEND_FOR_ACCOUNTS");
    }
    if (args.decision === "suspend") {
      if (
        args.suspensionUntil !== undefined &&
        args.suspensionUntil <= Date.now()
      )
        fail("INVALID_EXPIRY");
      await ctx.db.patch(r.subject, {
        status: "suspended",
        suspensionReason: reason,
        suspensionUntil: args.suspensionUntil,
      });
    }
    await ctx.db.patch(r._id, {
      status: "closed",
      decision: args.decision,
      reviewer: me._id,
      closedAt: Date.now(),
    });
    await ctx.db.insert("moderation", {
      actor: me._id,
      subject: r.subject,
      reportId: r._id,
      action: args.decision,
      reason,
    });
  },
});
export const myCases = query({
  args: {},
  handler: async (ctx) => {
    const me = await user(ctx, true);
    const actions = await ctx.db
      .query("moderation")
      .withIndex("subject", (q) => q.eq("subject", me._id))
      .order("desc")
      .take(100);
    const appeals = await ctx.db
      .query("appeals")
      .withIndex("user", (q) => q.eq("userId", me._id))
      .collect();
    return { actions, appeals };
  },
});
export const appeal = mutation({
  args: { moderationId: v.id("moderation"), text: v.string() },
  handler: async (ctx, args) => {
    const me = await user(ctx, true);
    const m = await ctx.db.get(args.moderationId);
    if (!m || m.subject !== me._id || !["suspend", "remove"].includes(m.action))
      fail("NOT_FOUND");
    const old = await ctx.db
      .query("appeals")
      .withIndex("user", (q) => q.eq("userId", me._id))
      .collect();
    if (old.some((a) => a.moderationId === m._id)) fail("ALREADY_APPEALED");
    if (Date.now() - m._creationTime > 30 * 86400000)
      fail("APPEAL_WINDOW_CLOSED");
    await quota(ctx, me._id, "appeal", 5);
    return ctx.db.insert("appeals", {
      userId: me._id,
      moderationId: m._id,
      text: bounded(args.text, 2000, true),
      status: "open",
    });
  },
});
export const resolveAppealCommit = internalMutation({
  args: {
    id: v.id("appeals"),
    reverse: v.boolean(),
    reason: v.string(),
    restoredStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const me = await admin(ctx);
    const a = await ctx.db.get(args.id);
    const m = a ? await ctx.db.get(a.moderationId) : null;
    if (
      !a ||
      !m ||
      a.status !== "open" ||
      a.userId === me._id ||
      m.actor === me._id
    )
      fail("REVIEW_CONFLICT");
    const reason = bounded(args.reason, 1000, true);
    const subject = await ctx.db.get(a.userId);
    if (!subject || subject.status === "deleted") fail("ACCOUNT_DELETED");
    if (args.reverse && m.action === "suspend") {
      const latest = await ctx.db
        .query("moderation")
        .withIndex("subject", (q) => q.eq("subject", a.userId))
        .order("desc")
        .first();
      if (latest?._id !== m._id) fail("NEWER_ACTION_REQUIRES_REVIEW");
      await ctx.db.patch(a.userId, {
        status: "active",
        suspensionUntil: undefined,
        suspensionReason: undefined,
      });
    }
    if (args.reverse && m.action === "remove" && m.reportId) {
      const report = await ctx.db.get(m.reportId);
      if (!report) fail("EVIDENCE_EXPIRED");
      if (report.target.kind === "post") {
        const id = ctx.db.normalizeId("posts", report.target.id);
        const post = id ? await ctx.db.get(id) : null;
        if (!post || post.deletedByOwner) fail("AUTHOR_DELETED");
        if (!args.restoredStorageId) fail("EVIDENCE_EXPIRED");
        await ctx.db.patch(post.mediaId, {
          storageId: args.restoredStorageId,
          state: "published",
        });
        await ctx.db.patch(post._id, { deleted: false });
      } else if (report.target.kind === "comment") {
        const id = ctx.db.normalizeId("comments", report.target.id);
        const comment = id ? await ctx.db.get(id) : null;
        if (!comment || comment.deletedByOwner) fail("AUTHOR_DELETED");
        await ctx.db.patch(comment._id, { deleted: false });
      } else if (report.target.kind === "message") {
        const id = ctx.db.normalizeId("messages", report.target.id);
        const message = id ? await ctx.db.get(id) : null;
        if (!message) fail("NOT_FOUND");
        if (message.mediaId) {
          if (!args.restoredStorageId) fail("EVIDENCE_EXPIRED");
          await ctx.db.patch(message.mediaId, {
            storageId: args.restoredStorageId,
            state: "published",
          });
        }
        await ctx.db.patch(message._id, { removed: false });
      }
    }
    await ctx.db.patch(a._id, {
      status: args.reverse ? "reversed" : "upheld",
      resolution: reason,
      reviewer: me._id,
    });
    if (m.reportId) await ctx.db.patch(m.reportId, { closedAt: Date.now() });
    await ctx.db.insert("moderation", {
      actor: me._id,
      subject: a.userId,
      action: args.reverse ? "appeal_reversed" : "appeal_upheld",
      reason,
    });
  },
});
export const appealSnapshot = internalQuery({
  args: { id: v.id("appeals") },
  handler: async (ctx, { id }) => {
    const me = await admin(ctx);
    const appeal = await ctx.db.get(id);
    const action = appeal ? await ctx.db.get(appeal.moderationId) : null;
    if (
      !appeal ||
      !action ||
      appeal.status !== "open" ||
      appeal.userId === me._id ||
      action.actor === me._id
    )
      fail("REVIEW_CONFLICT");
    const report = action.reportId ? await ctx.db.get(action.reportId) : null;
    return {
      storageId:
        action.action === "remove" ? report?.evidenceStorageId : undefined,
    };
  },
});
export const resolveAppeal = action({
  args: { id: v.id("appeals"), reverse: v.boolean(), reason: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const snapshot = await ctx.runQuery(internal.admin.appealSnapshot, {
      id: args.id,
    });
    let restoredStorageId: Id<"_storage"> | undefined;
    try {
      if (args.reverse && snapshot.storageId) {
        const blob = await ctx.storage.get(snapshot.storageId);
        if (!blob) fail("EVIDENCE_EXPIRED");
        restoredStorageId = await ctx.storage.store(blob);
      }
      await ctx.runMutation(internal.admin.resolveAppealCommit, {
        ...args,
        restoredStorageId,
      });
    } catch (error) {
      if (restoredStorageId) await ctx.storage.delete(restoredStorageId);
      throw error;
    }
  },
});
export const reinstate = mutation({
  args: { id: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const me = await admin(ctx);
    if (me._id === args.id) fail("REVIEW_CONFLICT");
    const p = await ctx.db.get(args.id);
    if (!p || p.status !== "suspended") fail("NOT_FOUND");
    if (me.role === "reviewer" && p.role !== "admin")
      fail("USE_INDEPENDENT_APPEAL");
    await ctx.db.patch(p._id, {
      status: "active",
      suspensionUntil: undefined,
      suspensionReason: undefined,
    });
    await ctx.db.insert("moderation", {
      actor: me._id,
      subject: p._id,
      action: "reinstate",
      reason: bounded(args.reason, 1000, true),
    });
  },
});
export const resolveCorrection = mutation({
  args: { id: v.id("corrections"), approve: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    const me = await admin(ctx, false);
    const c = await ctx.db.get(args.id);
    if (!c || c.status !== "open" || c.userId === me._id)
      fail("REVIEW_CONFLICT");
    if (args.approve) {
      cohort(c.birthDate);
      await ctx.db.patch(c.userId, {
        birthDate: c.birthDate,
        processedAdult: false,
      });
    }
    await ctx.db.patch(c._id, {
      status: args.approve ? "approved" : "rejected",
    });
    await ctx.db.insert("moderation", {
      actor: me._id,
      subject: c.userId,
      action: "birth_correction",
      reason: bounded(args.reason, 1000, true),
    });
  },
});
export const evidence = internalQuery({
  args: { id: v.id("reports") },
  handler: async (ctx, { id }) => {
    const me = await admin(ctx);
    const r = await ctx.db.get(id);
    if (!r || r.subject === me._id || r.reporter === me._id)
      fail("REVIEW_CONFLICT");
    if (!(await mayReview(ctx, me, r))) fail("REVIEW_CONFLICT");
    return { storageId: r.evidenceStorageId, mime: r.evidenceMime };
  },
});
