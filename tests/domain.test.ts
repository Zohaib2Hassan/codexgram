import { describe, expect, it } from "vitest";
import {
  anniversary,
  cohort,
  entitlement,
  username,
  validateWebsite,
} from "../shared/domain";
import { byteRange, inspectMedia } from "../shared/media";
import { afterFailure, restored, type OutboxItem } from "../src/lib/outbox";
describe("age and one-year entitlement", () => {
  it("uses a calendar anniversary and clamps leap day", () => {
    expect(
      new Date(anniversary(Date.parse("2024-02-29T12:30:00Z"))).toISOString(),
    ).toBe("2025-02-28T12:30:00.000Z");
    expect(
      new Date(
        entitlement(Date.parse("2026-10-05T10:00:00Z")).freeAccessEndsAt,
      ).toISOString(),
    ).toBe("2027-10-05T10:00:00.000Z");
  });
  it("switches cohorts exactly at the UTC birthday", () => {
    expect(cohort("2008-10-05", Date.parse("2026-10-04T23:59:59Z"))).toBe(
      "teen",
    );
    expect(cohort("2008-10-05", Date.parse("2026-10-05T00:00:00Z"))).toBe(
      "adult",
    );
  });
  it("rejects malformed dates and under-13 accounts", () => {
    for (const date of ["2013-02-30", "2050-01-01", "2020-01-01"])
      expect(() => cohort(date, Date.parse("2026-10-05"))).toThrow();
  });
  it("normalizes usernames and rejects unsafe website schemes", () => {
    expect(username(" Alice_1 ")).toBe("alice_1");
    expect(() => username("ab")).toThrow();
    expect(() => validateWebsite("javascript:alert(1)")).toThrow();
  });
});
describe("protected media", () => {
  it("validates byte ranges including suffixes", () => {
    expect(byteRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(byteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(byteRange("bytes=50-", 100)).toEqual({ start: 50, end: 99 });
    for (const r of ["bytes=100-", "bytes=4-2", "bytes=0-1,5-9", "bytes=-"])
      expect(() => byteRange(r, 100)).toThrow();
  });
  it("does not trust declared file metadata", () => {
    expect(() =>
      inspectMedia(new TextEncoder().encode("<script>bad</script>")),
    ).toThrow("UNSUPPORTED_MEDIA");
    expect(() => inspectMedia(new Uint8Array(15_000_001))).toThrow(
      "MEDIA_TOO_LARGE",
    );
  });
  it("reads MP4 duration and rejects overlong videos", () => {
    const bytes = new Uint8Array(48);
    const v = new DataView(bytes.buffer);
    const name = (at: number, s: string) =>
      bytes.set(new TextEncoder().encode(s), at);
    v.setUint32(0, 16);
    name(4, "ftyp");
    name(8, "mp42");
    v.setUint32(16, 32);
    name(20, "moov");
    v.setUint32(24, 24);
    name(28, "mvhd");
    v.setUint32(44, 1000);
    expect(() => inspectMedia(bytes)).toThrow();
  });
});
describe("durable outbox state", () => {
  const item: OutboxItem = {
    id: "one",
    owner: "alice",
    kind: "message",
    text: "hello",
    state: "sending",
    attempts: 0,
    nextAt: 0,
  };
  it("recovers interrupted sends without changing operation identity", () => {
    expect(restored([item])[0]).toMatchObject({
      id: "one",
      owner: "alice",
      state: "pending",
    });
  });
  it("requires confirmation after quota pauses and stops permission retries", () => {
    expect(afterFailure(item, "QUOTA_PAUSED").state).toBe("paused");
    expect(afterFailure(item, "CHAT_READ_ONLY").state).toBe("failed");
    expect(afterFailure(item, "network").state).toBe("pending");
    expect(afterFailure({ ...item, attempts: 3 }, "network").state).toBe(
      "failed",
    );
  });
});
