import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { preferences } from "./schema";
import {
  active,
  controls,
  digest,
  fail,
  maybeUser,
  publicUser,
  quota,
  user,
  visibleUser,
} from "./lib/access";
import {
  bounded,
  cohort,
  entitlement,
  username,
  validateWebsite,
} from "../shared/domain";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const me = await maybeUser(ctx);
    if (!me || me.status === "deleted") return null;
    return {
      ...me,
      active: active(me),
      cohort: cohort(me.birthDate),
      entitlement: await ctx.db
        .query("entitlements")
        .withIndex("user", (q) => q.eq("userId", me._id))
        .unique(),
    };
  },
});
export const onboard = mutation({
  args: {
    invite: v.string(),
    birthDate: v.string(),
    username: v.string(),
    displayName: v.string(),
    locale: v.union(v.literal("en"), v.literal("ur")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) fail("SIGN_IN_REQUIRED");
    const existing = await maybeUser(ctx);
    if (existing?.status === "deleted") fail("ACCOUNT_DELETED");
    if (existing) return existing._id;
    const settings = await controls(ctx);
    if (settings.invitationsPaused || settings.estimatedMonthlyUsd >= 20)
      fail("INVITATIONS_PAUSED");
    const people = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("status"), "deleted"))
      .take(501);
    if (people.filter((p) => p.status !== "deleted").length >= settings.userCap)
      fail("BETA_FULL");
    const name = username(args.username);
    const group = cohort(args.birthDate);
    if (
      await ctx.db
        .query("users")
        .withIndex("username", (q) => q.eq("username", name))
        .unique()
    )
      fail("USERNAME_TAKEN");
    const hash = await digest(args.invite.trim());
    const invite = await ctx.db
      .query("invitations")
      .withIndex("digest", (q) => q.eq("digest", hash))
      .unique();
    if (
      !invite ||
      invite.revoked ||
      invite.usedBy ||
      invite.expiresAt <= Date.now()
    )
      fail("INVALID_INVITE");
    const id = await ctx.db.insert("users", {
      clerkId: identity.subject,
      username: name,
      displayName: bounded(args.displayName, 60, true),
      birthDate: args.birthDate,
      bio: "",
      website: "",
      location: "",
      locale: args.locale,
      autoplay: "wifi",
      preferences: {
        dm: true,
        follow: true,
        like: true,
        comment: true,
        mention: true,
      },
      role: "member",
      status: "active",
      processedAdult: group === "adult",
      suggestionsDone: false,
    });
    await ctx.db.patch(invite._id, { usedBy: id });
    await ctx.db.insert("entitlements", {
      userId: id,
      ...entitlement(Date.now()),
    });
    return id;
  },
});
export const update = mutation({
  args: {
    username: v.string(),
    displayName: v.string(),
    bio: v.string(),
    website: v.string(),
    location: v.string(),
    locale: v.union(v.literal("en"), v.literal("ur")),
    autoplay: v.union(
      v.literal("wifi"),
      v.literal("always"),
      v.literal("never"),
    ),
    preferences,
  },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const name = username(args.username);
    const duplicate = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", name))
      .unique();
    if (duplicate && duplicate._id !== me._id) fail("USERNAME_TAKEN");
    await ctx.db.patch(me._id, {
      ...args,
      username: name,
      displayName: bounded(args.displayName, 60, true),
      bio: bounded(args.bio, 300),
      website: validateWebsite(args.website),
      location: bounded(args.location, 80),
    });
  },
});
export const finishSuggestions = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await user(ctx);
    await ctx.db.patch(me._id, { suggestionsDone: true });
  },
});
export const people = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await user(ctx);
    const term = bounded(args.search ?? "", 100).toLocaleLowerCase();
    // Admission is capped at 500; scanning this bounded directory supports Urdu substring search too.
    const rows = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("status"), "deleted"))
      .take(501);
    const result = [];
    for (const p of rows)
      if (
        p._id !== me._id &&
        (!term ||
          `${p.username} ${p.displayName}`
            .toLocaleLowerCase()
            .includes(term)) &&
        (await visibleUser(ctx, me, p))
      ) {
        result.push({
          ...publicUser(p),
          following: !!(await ctx.db
            .query("follows")
            .withIndex("pair", (q) => q.eq("from", me._id).eq("to", p._id))
            .unique()),
        });
      }
    return result.slice(0, 100);
  },
});
export const profile = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    const me = await user(ctx);
    const p = await ctx.db.get(id);
    if (!p || !(id === me._id || (await visibleUser(ctx, me, p)))) return null;
    return {
      ...publicUser(p),
      following: !!(await ctx.db
        .query("follows")
        .withIndex("pair", (q) => q.eq("from", me._id).eq("to", id))
        .unique()),
      muted: !!(await ctx.db
        .query("mutes")
        .withIndex("pair", (q) => q.eq("from", me._id).eq("to", id))
        .unique()),
    };
  },
});
export const requestBirthCorrection = mutation({
  args: { birthDate: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const me = await user(ctx, true);
    cohort(args.birthDate);
    await quota(ctx, me._id, "birth_correction", 2);
    return ctx.db.insert("corrections", {
      userId: me._id,
      birthDate: args.birthDate,
      reason: bounded(args.reason, 1000, true),
      status: "open",
    });
  },
});
