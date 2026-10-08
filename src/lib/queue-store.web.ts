import type { OutboxItem } from "./outbox";
export async function loadItems(_owner: string): Promise<OutboxItem[]> {
  return [];
}
export async function saveItem(_item: OutboxItem) {
  throw new Error("MOBILE_ONLY");
}
export async function removeItem(_item: OutboxItem) {}
export function persistFile(_uri: string, _id: string): string {
  throw new Error("MOBILE_ONLY");
}
export async function fileBody(_uri: string): Promise<Uint8Array> {
  throw new Error("MOBILE_ONLY");
}
