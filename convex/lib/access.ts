import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { cohort, dayKey } from "../../shared/domain";
type Ctx = QueryCtx | MutationCtx;
export function fail(code: string): never {
  throw new ConvexError(code);
}
export function active(user: Doc<"users">) {
  return (
    user.status === "active" ||
    (user.status === "suspended" &&
      user.suspensionUntil !== undefined &&
      user.suspensionUntil <= Date.now())
  );
}
export async function maybeUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  return identity
    ? ctx.db
        .query("users")
        .withIndex("clerk", (q) => q.eq("clerkId", identity.subject))
        .unique()
    : null;
}
export async function user(ctx: Ctx, allowSuspended = false) {
  const me = await maybeUser(ctx);
  if (!me || me.status === "deleted") fail("SIGN_IN_REQUIRED");
  if (!allowSuspended && !active(me)) fail("ACCOUNT_SUSPENDED");
  return me;
}
export async function admin(ctx: Ctx, allowReviewer = true) {
  const me = await user(ctx);
  if (me.role !== "admin" && !(allowReviewer && me.role === "reviewer"))
    fail("ADMIN_REQUIRED");
  return me;
}
export async function blocked(ctx: Ctx, a: Id<"users">, b: Id<"users">) {
  return !!(
    (await ctx.db
      .query("blocks")
      .withIndex("pair", (q) => q.eq("from", a).eq("to", b))
      .unique()) ||
    (await ctx.db
      .query("blocks")
      .withIndex("pair", (q) => q.eq("from", b).eq("to", a))
      .unique())
  );
}
export async function visibleUser(
  ctx: Ctx,
  me: Doc<"users">,
  other: Doc<"users"> | null,
) {
  return (
    !!other &&
    active(other) &&
    cohort(me.birthDate) === cohort(other.birthDate) &&
    !(await blocked(ctx, me._id, other._id))
  );
}
export async function visiblePost(
  ctx: Ctx,
  me: Doc<"users">,
  post: Doc<"posts"> | null,
) {
  if (!post || post.deleted) return false;
  if (post.author === me._id) return true;
  const author = await ctx.db.get(post.author);
  return (
    !post.archived &&
    post.publishedCohort === cohort(me.birthDate) &&
    (await visibleUser(ctx, me, author))
  );
}
export function publicUser(u: Doc<"users">) {
  return {
    _id: u._id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    website: u.website,
    location: u.location,
    avatarId: u.avatarId,
  };
}
export async function canSend(
  ctx: Ctx,
  me: Doc<"users">,
  other: Doc<"users"> | null,
) {
  if (
    !other ||
    other._id === me._id ||
    !active(me) ||
    !(await visibleUser(ctx, me, other))
  )
    return false;
  return !!(
    (await ctx.db
      .query("follows")
      .withIndex("pair", (q) => q.eq("from", me._id).eq("to", other._id))
      .unique()) &&
    (await ctx.db
      .query("follows")
      .withIndex("pair", (q) => q.eq("from", other._id).eq("to", me._id))
      .unique())
  );
}
export async function controls(ctx: Ctx) {
  return (
    (await ctx.db
      .query("controls")
      .withIndex("key", (q) => q.eq("key", "global"))
      .unique()) ?? {
      invitationsPaused: false,
      uploadsPaused: false,
      mediaPaused: false,
      estimatedMonthlyUsd: 0,
      userCap: 50,
    }
  );
}
export async function quota(
  ctx: MutationCtx,
  me: Id<"users">,
  kind: string,
  limit: number,
) {
  const day = dayKey();
  const row = await ctx.db
    .query("usage")
    .withIndex("key", (q) => q.eq("userId", me).eq("day", day).eq("kind", kind))
    .unique();
  if ((row?.count ?? 0) >= limit) fail("QUOTA_PAUSED");
  if (row) await ctx.db.patch(row._id, { count: row.count + 1 });
  else await ctx.db.insert("usage", { userId: me, day, kind, count: 1 });
}
export async function digest(text: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
