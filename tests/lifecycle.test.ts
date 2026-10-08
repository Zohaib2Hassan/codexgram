/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect, vi, afterEach } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { digest } from "../convex/lib/access";
const modules = import.meta.glob("../convex/**/*.ts");
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  const t = convexTest(schema, modules);
  const people = [];
  for (const name of ["author", "reporter", "primary", "backup"]) {
    await t.run(async (ctx) =>
      ctx.db.insert("invitations", {
        digest: await digest(name),
        createdBy: "test",
        expiresAt: Date.now() + 999999,
        revoked: false,
      }),
    );
    const client = t.withIdentity({ subject: name });
    const id = await client.mutation(api.users.onboard, {
      invite: name,
      username: name,
      displayName: name,
      birthDate: "2000-01-01",
      locale: "en",
    });
    people.push({ id, client });
  }
  const [author, reporter, primary, backup] = people;
  await t.run(async (ctx) => {
    await ctx.db.patch(primary.id, { role: "admin" });
    await ctx.db.patch(backup.id, { role: "reviewer" });
  });
  const mediaId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["test image"]));
    return ctx.db.insert("media", {
      owner: author.id,
      operationId: "image",
      storageId,
      kind: "image",
      mime: "image/jpeg",
      size: 10,
      state: "ready",
    });
  });
  const postId = await author.client.mutation(api.social.publish, {
    expectedUserId: author.id,
    operationId: "post",
    mediaId,
    caption: "Original text",
  });
  return { t, author, reporter, primary, backup, mediaId, postId };
}
afterEach(() => vi.useRealTimers());
describe("moderation, evidence and access changes", () => {
  it("serves ranges only to authenticated eligible viewers", async () => {
    const { t, author, reporter, mediaId } = await fixture();
    const anonymous = await t.fetch(`/media?id=${mediaId}`);
    expect(anonymous.status).toBe(403);
    const response = await reporter.client.fetch(`/media?id=${mediaId}`, {
      headers: { Range: "bytes=0-3" },
    });
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-3/10");
    expect((await response.arrayBuffer()).byteLength).toBe(4);
    const badRange = await reporter.client.fetch(`/media?id=${mediaId}`, {
      headers: { Range: "bytes=999-" },
    });
    expect(badRange.status).toBe(416);
    await author.client.mutation(api.social.relationship, {
      id: reporter.id,
      kind: "block",
      enabled: true,
    });
    expect((await reporter.client.fetch(`/media?id=${mediaId}`)).status).toBe(
      403,
    );
  });
  it("shows unavailable saved posts without leaking captions", async () => {
    const { author, reporter, postId } = await fixture();
    await reporter.client.mutation(api.social.toggle, {
      id: postId,
      kind: "bookmark",
      enabled: true,
    });
    await author.client.mutation(api.social.deletePost, { id: postId });
    const result = await reporter.client.query(api.social.saved, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].post).toBeNull();
  });
  it("preserves reported media after owner deletion and removes it after retention", async () => {
    const { t, author, reporter, primary, postId } = await fixture();
    const reportId = await reporter.client.action(api.admin.report, {
      target: { kind: "post", id: postId },
      reason: "Review this",
    });
    await author.client.mutation(api.social.deletePost, { id: postId });
    const evidence = await primary.client.query(internal.admin.evidence, {
      id: reportId,
    });
    expect(evidence.storageId).toBeDefined();
    expect(
      await t.run(
        async (ctx) => !!(await ctx.storage.get(evidence.storageId!)),
      ),
    ).toBe(true);
    await primary.client.mutation(api.admin.review, {
      id: reportId,
      decision: "dismiss",
      reason: "No violation",
    });
    vi.setSystemTime(new Date("2026-11-06"));
    await t.mutation(internal.maintenance.hourly, {});
    expect(
      (await t.run((ctx) => ctx.db.get(reportId)))?.evidenceStorageId,
    ).toBeUndefined();
  });
  it("prevents the decision maker resolving their own appeal and restores removed content", async () => {
    const { author, reporter, primary, backup, postId } = await fixture();
    const reportId = await reporter.client.action(api.admin.report, {
      target: { kind: "post", id: postId },
      reason: "Review",
    });
    await primary.client.mutation(api.admin.review, {
      id: reportId,
      decision: "remove",
      reason: "Removed for review",
    });
    expect(
      await author.client.query(api.social.post, { id: postId }),
    ).toBeNull();
    const appealId = await author.client.mutation(api.admin.appeal, {
      moderationId: (await author.client.query(api.admin.myCases)).actions[0]
        ._id,
      text: "Please reconsider",
    });
    await expect(
      primary.client.action(api.admin.resolveAppeal, {
        id: appealId,
        reverse: true,
        reason: "Self review",
      }),
    ).rejects.toThrow("REVIEW_CONFLICT");
    await backup.client.action(api.admin.resolveAppeal, {
      id: appealId,
      reverse: true,
      reason: "No violation",
    });
    const restored = await author.client.query(api.social.post, { id: postId });
    expect(restored?.caption).toBe("Original text");
    expect(restored?.media).not.toBeNull();
  });
  it("does not restore content the author subsequently deleted", async () => {
    const { author, reporter, primary, backup, postId } = await fixture();
    const reportId = await reporter.client.action(api.admin.report, {
      target: { kind: "post", id: postId },
      reason: "Review",
    });
    await primary.client.mutation(api.admin.review, {
      id: reportId,
      decision: "remove",
      reason: "Review",
    });
    const appealId = await author.client.mutation(api.admin.appeal, {
      moderationId: (await author.client.query(api.admin.myCases)).actions[0]
        ._id,
      text: "Appeal",
    });
    await author.client.mutation(api.social.deletePost, { id: postId });
    await expect(
      backup.client.action(api.admin.resolveAppeal, {
        id: appealId,
        reverse: true,
        reason: "Restore",
      }),
    ).rejects.toThrow("AUTHOR_DELETED");
  });
  it("keeps evidence while an appeal is open", async () => {
    const { t, author, reporter, primary, postId } = await fixture();
    const reportId = await reporter.client.action(api.admin.report, {
      target: { kind: "post", id: postId },
      reason: "Review",
    });
    await primary.client.mutation(api.admin.review, {
      id: reportId,
      decision: "remove",
      reason: "Review",
    });
    await author.client.mutation(api.admin.appeal, {
      moderationId: (await author.client.query(api.admin.myCases)).actions[0]
        ._id,
      text: "Appeal",
    });
    vi.setSystemTime(new Date("2026-12-06"));
    await t.mutation(internal.maintenance.hourly, {});
    expect(
      (await t.run((ctx) => ctx.db.get(reportId)))?.evidenceStorageId,
    ).toBeDefined();
  });
  it("expires timed suspensions and blocks reviewer control changes", async () => {
    const { t, author, backup } = await fixture();
    await t.run((ctx) =>
      ctx.db.patch(author.id, {
        status: "suspended",
        suspensionUntil: Date.now() + 1000,
      }),
    );
    await expect(author.client.query(api.users.people, {})).rejects.toThrow(
      "ACCOUNT_SUSPENDED",
    );
    vi.setSystemTime(Date.now() + 1001);
    await expect(
      author.client.query(api.users.people, {}),
    ).resolves.toBeDefined();
    await expect(
      backup.client.mutation(api.admin.setControls, {
        invitationsPaused: false,
        uploadsPaused: false,
        mediaPaused: false,
        estimatedMonthlyUsd: 0,
        userCap: 500,
      }),
    ).rejects.toThrow("ADMIN_REQUIRED");
  });
  it("does not allow stale-account operation IDs to send under a different login", async () => {
    const { author, reporter } = await fixture();
    await author.client.mutation(api.social.follow, {
      id: reporter.id,
      enabled: true,
    });
    await reporter.client.mutation(api.social.follow, {
      id: author.id,
      enabled: true,
    });
    const conversationId = await author.client.mutation(api.messages.start, {
      otherId: reporter.id,
    });
    await expect(
      reporter.client.mutation(api.messages.send, {
        expectedUserId: author.id,
        conversationId,
        text: "Stale draft",
        operationId: "old-session",
      }),
    ).rejects.toThrow("SESSION_MISMATCH");
  });
  it("applies daily media publication quotas and idempotent upload reservations", async () => {
    const { t, author } = await fixture();
    await t.run((ctx) =>
      ctx.db.insert("usage", {
        userId: author.id,
        day: "2026-10-05",
        kind: "upload",
        count: 39,
      }),
    );
    await author.client.mutation(internal.media.authorizeUpload, {
      operationId: "last",
    });
    await author.client.mutation(internal.media.authorizeUpload, {
      operationId: "last",
    });
    await expect(
      author.client.mutation(internal.media.authorizeUpload, {
        operationId: "too-many",
      }),
    ).rejects.toThrow("QUOTA_PAUSED");
  });
  it("suppresses push for opted-out recipients and inaccessible targets", async () => {
    const { t, author, reporter, postId } = await fixture();
    await reporter.client.mutation(api.social.toggle, {
      id: postId,
      kind: "like",
      enabled: true,
    });
    const note = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("recipient", (q) => q.eq("recipient", author.id))
        .first(),
    );
    expect(note).not.toBeNull();
    await t.run(async (ctx) => {
      const p = await ctx.db.get(author.id);
      await ctx.db.patch(author.id, {
        preferences: { ...p!.preferences, like: false },
      });
    });
    expect(
      await t.query(internal.notifications.payload, { id: note!._id }),
    ).toBeNull();
  });
});
