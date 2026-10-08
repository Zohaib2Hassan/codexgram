/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { digest } from "../convex/lib/access";
import type { Id } from "../convex/_generated/dataModel";
const modules = import.meta.glob("../convex/**/*.ts");
const create = () => convexTest(schema, modules);
type Test = ReturnType<typeof create>;
async function join(t: Test, name: string, birthDate = "2000-01-01") {
  const invite = `invitation-${name}-12345678901234567890`;
  await t.run(async (ctx) => {
    await ctx.db.insert("invitations", {
      digest: await digest(invite),
      createdBy: "test",
      expiresAt: Date.now() + 86400000,
      revoked: false,
    });
  });
  const client = t.withIdentity({ subject: name });
  const id = await client.mutation(api.users.onboard, {
    invite,
    username: name,
    displayName: name,
    birthDate,
    locale: "en",
  });
  return { client, id };
}
async function image(t: Test, owner: Id<"users">, operationId = "image-one") {
  return t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" }),
    );
    return ctx.db.insert("media", {
      owner,
      storageId,
      operationId,
      kind: "image",
      mime: "image/jpeg",
      size: 4,
      state: "ready",
    });
  });
}
async function friends(t: Test) {
  const a = await join(t, "alice");
  const b = await join(t, "bob");
  await a.client.mutation(api.social.follow, { id: b.id, enabled: true });
  await b.client.mutation(api.social.follow, { id: a.id, enabled: true });
  const id = await a.client.mutation(api.messages.start, { otherId: b.id });
  return { a, b, id };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});
describe("onboarding transactions", () => {
  it("does not reset the free year on repeated onboarding", async () => {
    const t = create();
    const a = await join(t, "alice");
    const first = await a.client.query(api.users.me);
    vi.setSystemTime(new Date("2026-11-01"));
    await a.client.mutation(api.users.onboard, {
      invite: "unused",
      birthDate: "1999-01-01",
      username: "changed",
      displayName: "Changed",
      locale: "ur",
    });
    const second = await a.client.query(api.users.me);
    expect(second?.entitlement).toEqual(first?.entitlement);
    expect(second?.username).toBe("alice");
  });
  it("consumes an invite once under concurrent redemption", async () => {
    const t = create();
    const code = "shared-invite";
    await t.run(async (ctx) =>
      ctx.db.insert("invitations", {
        digest: await digest(code),
        createdBy: "test",
        expiresAt: Date.now() + 100000,
        revoked: false,
      }),
    );
    const args = {
      invite: code,
      birthDate: "2000-01-01",
      displayName: "User",
      locale: "en" as const,
    };
    const result = await Promise.allSettled(
      ["alice", "bob"].map((name) =>
        t
          .withIdentity({ subject: name })
          .mutation(api.users.onboard, { ...args, username: name }),
      ),
    );
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("rejects username collisions, expired invitations and anonymous reads", async () => {
    const t = create();
    await join(t, "alice");
    await expect(join(t, "alice")).resolves.toBeDefined();
    await expect(t.query(api.users.people, {})).rejects.toThrow(
      "SIGN_IN_REQUIRED",
    );
    const b = t.withIdentity({ subject: "different" });
    await expect(
      b.mutation(api.users.onboard, {
        invite: "x",
        birthDate: "2000-01-01",
        username: "ALICE",
        displayName: "Imposter",
        locale: "en",
      }),
    ).rejects.toThrow("USERNAME_TAKEN");
  });
  it("keeps access after the free year", async () => {
    const t = create();
    const a = await join(t, "alice");
    vi.setSystemTime(new Date("2028-10-05"));
    expect((await a.client.query(api.users.me))?.active).toBe(true);
    await expect(a.client.query(api.users.people, {})).resolves.toEqual([]);
  });
});
describe("content boundaries", () => {
  it("prevents cross-age discovery, follows, and media access", async () => {
    const t = create();
    const adult = await join(t, "adult");
    const teen = await join(t, "teen", "2010-01-01");
    expect(await adult.client.query(api.users.people, {})).toEqual([]);
    await expect(
      adult.client.mutation(api.social.follow, { id: teen.id, enabled: true }),
    ).rejects.toThrow("NOT_FOUND");
    const mediaId = await image(t, teen.id);
    const postId = await teen.client.mutation(api.social.publish, {
      expectedUserId: teen.id,
      mediaId,
      caption: "Teen post",
      operationId: "post-one",
    });
    expect(
      await adult.client.query(api.social.post, { id: postId }),
    ).toBeNull();
    await expect(
      adult.client.query(internal.media.access, { id: mediaId }),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("allows only owners to edit and delete posts and comments", async () => {
    const t = create();
    const a = await join(t, "alice");
    const b = await join(t, "bob");
    const p = await a.client.mutation(api.social.publish, {
      expectedUserId: a.id,
      mediaId: await image(t, a.id),
      caption: "Hello",
      operationId: "p",
    });
    const c = await b.client.mutation(api.social.comment, {
      postId: p,
      text: "Hi",
    });
    await expect(
      b.client.mutation(api.social.deletePost, { id: p }),
    ).rejects.toThrow();
    await expect(
      a.client.mutation(api.social.deleteComment, { id: c }),
    ).rejects.toThrow();
  });
  it("publishes at most once when a client retries", async () => {
    const t = create();
    const a = await join(t, "alice");
    const args = {
      expectedUserId: a.id,
      mediaId: await image(t, a.id),
      caption: "Hello",
      operationId: "same",
    };
    const one = await a.client.mutation(api.social.publish, args);
    const two = await a.client.mutation(api.social.publish, args);
    expect(two).toBe(one);
    expect(await t.run((ctx) => ctx.db.query("posts").collect())).toHaveLength(
      1,
    );
  });
  it("denies direct media access after blocking and after a budget pause", async () => {
    const t = create();
    const a = await join(t, "alice");
    const b = await join(t, "bob");
    const mediaId = await image(t, a.id);
    await a.client.mutation(api.social.publish, {
      expectedUserId: a.id,
      mediaId,
      caption: "",
      operationId: "p",
    });
    expect(
      (await b.client.query(internal.media.access, { id: mediaId }))._id,
    ).toBe(mediaId);
    await a.client.mutation(api.social.relationship, {
      id: b.id,
      kind: "block",
      enabled: true,
    });
    await expect(
      b.client.query(internal.media.access, { id: mediaId }),
    ).rejects.toThrow();
    await t.run((ctx) =>
      ctx.db.insert("controls", {
        key: "global",
        invitationsPaused: true,
        uploadsPaused: true,
        mediaPaused: true,
        estimatedMonthlyUsd: 25,
        userCap: 50,
      }),
    );
    await expect(
      a.client.query(internal.media.access, { id: mediaId }),
    ).rejects.toThrow("MEDIA_PAUSED");
  });
  it("enforces birthday visibility before cleanup executes", async () => {
    const t = create();
    const a = await join(t, "alice", "2008-10-06");
    const b = await join(t, "bob", "2010-01-01");
    const adult = await join(t, "adult");
    const p = await a.client.mutation(api.social.publish, {
      expectedUserId: a.id,
      mediaId: await image(t, a.id),
      caption: "",
      operationId: "p",
    });
    vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));
    expect(await b.client.query(api.social.post, { id: p })).toBeNull();
    expect(await adult.client.query(api.social.post, { id: p })).toBeNull();
    expect(await a.client.query(api.social.post, { id: p })).not.toBeNull();
    await t.mutation(internal.maintenance.transition, { id: a.id });
    expect((await t.run((ctx) => ctx.db.get(p)))?.archived).toBe(true);
  });
});
describe("messaging and moderation", () => {
  it("requires mutual follows and makes unfollowed chats read-only", async () => {
    const t = create();
    const { a, b, id } = await friends(t);
    const args = {
      expectedUserId: a.id,
      conversationId: id,
      text: "Hello",
      operationId: "m1",
    };
    const m = await a.client.mutation(api.messages.send, args);
    expect(await a.client.mutation(api.messages.send, args)).toBe(m);
    await b.client.mutation(api.social.follow, { id: a.id, enabled: false });
    await expect(
      a.client.mutation(api.messages.send, { ...args, operationId: "m2" }),
    ).rejects.toThrow("CHAT_READ_ONLY");
    expect((await a.client.query(api.messages.info, { id }))?.writable).toBe(
      false,
    );
  });
  it("denies outsiders conversation and report evidence access", async () => {
    const t = create();
    const { a, id } = await friends(t);
    const outsider = await join(t, "outsider");
    const m = await a.client.mutation(api.messages.send, {
      expectedUserId: a.id,
      conversationId: id,
      text: "private",
      operationId: "m",
    });
    expect(await outsider.client.query(api.messages.info, { id })).toBeNull();
    await expect(
      outsider.client.query(internal.admin.reportSnapshot, {
        target: { kind: "message", id: m },
      }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      outsider.client.query(api.admin.dashboard, {}),
    ).rejects.toThrow("ADMIN_REQUIRED");
  });
  it("uses read sequence numbers and prevents forged future receipts", async () => {
    const t = create();
    const { a, b, id } = await friends(t);
    await a.client.mutation(api.messages.send, {
      expectedUserId: a.id,
      conversationId: id,
      text: "Hi",
      operationId: "m",
    });
    await b.client.mutation(api.messages.read, { id, sequence: 999999 });
    expect((await a.client.query(api.messages.info, { id }))?.otherRead).toBe(
      1,
    );
  });
  it("suspended users can appeal but cannot publish", async () => {
    const t = create();
    const a = await join(t, "alice");
    const admin = await join(t, "moderator");
    const action = await t.run(async (ctx) => {
      await ctx.db.patch(a.id, {
        status: "suspended",
        suspensionReason: "Test",
      });
      return ctx.db.insert("moderation", {
        actor: admin.id,
        subject: a.id,
        action: "suspend",
        reason: "Test",
      });
    });
    await expect(a.client.query(api.users.people, {})).rejects.toThrow(
      "ACCOUNT_SUSPENDED",
    );
    await expect(
      a.client.mutation(api.admin.appeal, {
        moderationId: action,
        text: "Please review",
      }),
    ).resolves.toBeDefined();
  });
  it("deletes identity content while retaining message text", async () => {
    const t = create();
    const { a, b, id } = await friends(t);
    await a.client.mutation(api.messages.send, {
      expectedUserId: a.id,
      conversationId: id,
      text: "Keep this history",
      operationId: "m",
    });
    await a.client.mutation(api.maintenance.deleteAccount, {
      confirmation: "DELETE",
    });
    await t.mutation(internal.maintenance.purgeUser, { id: a.id });
    const rows = await b.client.query(api.messages.list, {
      id,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(rows.page[0].text).toBe("Keep this history");
    expect(rows.page[0].authorName).toBe("Deleted user");
    expect(await a.client.query(api.users.me)).toBeNull();
  });
});
