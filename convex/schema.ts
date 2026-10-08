import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const category = v.union(
  v.literal("dm"),
  v.literal("follow"),
  v.literal("like"),
  v.literal("comment"),
  v.literal("mention"),
);
export const preferences = v.object({
  dm: v.boolean(),
  follow: v.boolean(),
  like: v.boolean(),
  comment: v.boolean(),
  mention: v.boolean(),
});
export const target = v.object({
  kind: v.union(
    v.literal("post"),
    v.literal("comment"),
    v.literal("message"),
    v.literal("user"),
  ),
  id: v.string(),
});
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    displayName: v.string(),
    birthDate: v.string(),
    bio: v.string(),
    website: v.string(),
    location: v.string(),
    avatarId: v.optional(v.id("media")),
    locale: v.union(v.literal("en"), v.literal("ur")),
    autoplay: v.union(
      v.literal("wifi"),
      v.literal("always"),
      v.literal("never"),
    ),
    preferences,
    role: v.union(
      v.literal("member"),
      v.literal("admin"),
      v.literal("reviewer"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("deleted"),
    ),
    suspensionUntil: v.optional(v.number()),
    suspensionReason: v.optional(v.string()),
    processedAdult: v.boolean(),
    suggestionsDone: v.boolean(),
  })
    .index("clerk", ["clerkId"])
    .index("username", ["username"])
    .searchIndex("search_names", { searchField: "displayName" }),
  entitlements: defineTable({
    userId: v.id("users"),
    freeAccessStartedAt: v.number(),
    freeAccessEndsAt: v.number(),
    expiryPolicy: v.literal("pricing_not_launched"),
  }).index("user", ["userId"]),
  invitations: defineTable({
    digest: v.string(),
    createdBy: v.string(),
    expiresAt: v.number(),
    usedBy: v.optional(v.id("users")),
    revoked: v.boolean(),
  }).index("digest", ["digest"]),
  follows: defineTable({ from: v.id("users"), to: v.id("users") })
    .index("pair", ["from", "to"])
    .index("to", ["to"]),
  blocks: defineTable({ from: v.id("users"), to: v.id("users") })
    .index("pair", ["from", "to"])
    .index("to", ["to"]),
  mutes: defineTable({ from: v.id("users"), to: v.id("users") }).index("pair", [
    "from",
    "to",
  ]),
  media: defineTable({
    owner: v.id("users"),
    operationId: v.string(),
    storageId: v.id("_storage"),
    kind: v.union(v.literal("image"), v.literal("video")),
    mime: v.string(),
    size: v.number(),
    duration: v.optional(v.number()),
    state: v.union(
      v.literal("ready"),
      v.literal("published"),
      v.literal("deleted"),
    ),
    context: v.optional(
      v.union(v.literal("post"), v.literal("message"), v.literal("avatar")),
    ),
    contextId: v.optional(v.string()),
  })
    .index("owner_op", ["owner", "operationId"])
    .index("owner", ["owner"]),
  uploadReservations: defineTable({
    owner: v.id("users"),
    operationId: v.string(),
    expiresAt: v.number(),
  }).index("owner_op", ["owner", "operationId"]),
  posts: defineTable({
    author: v.id("users"),
    mediaId: v.id("media"),
    caption: v.string(),
    publishedCohort: v.union(v.literal("teen"), v.literal("adult")),
    archived: v.boolean(),
    deleted: v.boolean(),
    deletedByOwner: v.optional(v.boolean()),
    operationId: v.string(),
  })
    .index("author", ["author"])
    .index("author_op", ["author", "operationId"])
    .searchIndex("captions", { searchField: "caption" }),
  comments: defineTable({
    postId: v.id("posts"),
    author: v.id("users"),
    text: v.string(),
    deleted: v.boolean(),
    deletedByOwner: v.optional(v.boolean()),
  })
    .index("post", ["postId"])
    .index("author", ["author"]),
  likes: defineTable({ userId: v.id("users"), postId: v.id("posts") })
    .index("pair", ["userId", "postId"])
    .index("post", ["postId"]),
  bookmarks: defineTable({
    userId: v.id("users"),
    postId: v.id("posts"),
  }).index("pair", ["userId", "postId"]),
  conversations: defineTable({
    a: v.id("users"),
    b: v.id("users"),
    key: v.string(),
    lastAt: v.number(),
    readA: v.number(),
    readB: v.number(),
    sequence: v.number(),
  })
    .index("key", ["key"])
    .index("a", ["a", "lastAt"])
    .index("b", ["b", "lastAt"]),
  messages: defineTable({
    conversationId: v.id("conversations"),
    author: v.id("users"),
    text: v.string(),
    mediaId: v.optional(v.id("media")),
    postId: v.optional(v.id("posts")),
    operationId: v.string(),
    sequence: v.number(),
    removed: v.boolean(),
  })
    .index("conversation", ["conversationId", "sequence"])
    .index("author_op", ["author", "operationId"])
    .index("author", ["author"]),
  notifications: defineTable({
    recipient: v.id("users"),
    actor: v.id("users"),
    category,
    target,
    read: v.boolean(),
    pushed: v.boolean(),
  }).index("recipient", ["recipient"]),
  devices: defineTable({ userId: v.id("users"), token: v.string() })
    .index("user", ["userId"])
    .index("token", ["token"]),
  reports: defineTable({
    reporter: v.id("users"),
    subject: v.id("users"),
    target,
    reason: v.string(),
    evidenceText: v.string(),
    evidenceStorageId: v.optional(v.id("_storage")),
    evidenceMime: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("closed")),
    closedAt: v.optional(v.number()),
    decision: v.optional(v.string()),
    reviewer: v.optional(v.id("users")),
  })
    .index("status", ["status"])
    .index("reporter", ["reporter"]),
  moderation: defineTable({
    actor: v.id("users"),
    subject: v.id("users"),
    reportId: v.optional(v.id("reports")),
    action: v.string(),
    reason: v.string(),
  }).index("subject", ["subject"]),
  appeals: defineTable({
    userId: v.id("users"),
    moderationId: v.id("moderation"),
    text: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("upheld"),
      v.literal("reversed"),
    ),
    resolution: v.optional(v.string()),
    reviewer: v.optional(v.id("users")),
  })
    .index("user", ["userId"])
    .index("status", ["status"]),
  corrections: defineTable({
    userId: v.id("users"),
    birthDate: v.string(),
    reason: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
  }).index("user", ["userId"]),
  usage: defineTable({
    userId: v.id("users"),
    day: v.string(),
    kind: v.string(),
    count: v.number(),
  }).index("key", ["userId", "day", "kind"]),
  controls: defineTable({
    key: v.literal("global"),
    invitationsPaused: v.boolean(),
    uploadsPaused: v.boolean(),
    mediaPaused: v.boolean(),
    estimatedMonthlyUsd: v.number(),
    userCap: v.number(),
  }).index("key", ["key"]),
  cleanup: defineTable({
    storageId: v.id("_storage"),
    after: v.number(),
  }).index("after", ["after"]),
});
