export const LIMITS = {
  imageBytes: 10_000_000,
  videoBytes: 15_000_000,
  videoSeconds: 60,
  postsPerDay: 10,
  dmMediaPerDay: 20,
} as const;
export type Cohort = "teen" | "adult";
export function birthTimestamp(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_BIRTH_DATE");
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  )
    throw new Error("INVALID_BIRTH_DATE");
  return timestamp;
}
export function anniversary(timestamp: number, years = 1): number {
  const source = new Date(timestamp);
  const result = new Date(timestamp);
  result.setUTCFullYear(source.getUTCFullYear() + years);
  if (result.getUTCMonth() !== source.getUTCMonth()) result.setUTCDate(0);
  return result.getTime();
}
export function cohort(birthDate: string, now = Date.now()): Cohort {
  const birth = birthTimestamp(birthDate);
  if (birth > now || anniversary(birth, 13) > now)
    throw new Error("AGE_NOT_ELIGIBLE");
  return anniversary(birth, 18) <= now ? "adult" : "teen";
}
export function username(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(normalized))
    throw new Error("INVALID_USERNAME");
  return normalized;
}
export function bounded(value: string, max: number, required = false): string {
  const text = value.trim();
  if ((required && !text) || text.length > max) throw new Error("INVALID_TEXT");
  return text;
}
export function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}
export function mentionedNames(text: string) {
  return [
    ...new Set(
      [...text.matchAll(/(?:^|\s)@([a-zA-Z0-9_]{3,24})\b/g)].map((m) =>
        m[1].toLowerCase(),
      ),
    ),
  ].slice(0, 10);
}
export function entitlement(start: number) {
  return {
    freeAccessStartedAt: start,
    freeAccessEndsAt: anniversary(start),
    expiryPolicy: "pricing_not_launched" as const,
  };
}
export function validateWebsite(value: string) {
  if (!value.trim()) return "";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("HTTPS_WEBSITE_REQUIRED");
  return bounded(url.toString(), 300);
}
