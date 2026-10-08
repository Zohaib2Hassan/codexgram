import * as SQLite from "expo-sqlite";
import { File, Paths } from "expo-file-system";
import type { OutboxItem } from "./outbox";
let db: ReturnType<typeof SQLite.openDatabaseAsync> | undefined;
async function database() {
  db ??= SQLite.openDatabaseAsync("outbox.db");
  const database = await db;
  await database.execAsync(
    "CREATE TABLE IF NOT EXISTS queue (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL)",
  );
  return database;
}
export async function loadItems(owner: string): Promise<OutboxItem[]> {
  const rows = await (
    await database()
  ).getAllAsync<{ payload: string }>(
    "SELECT payload FROM queue WHERE owner = ?",
    owner,
  );
  return rows.map((r) => JSON.parse(r.payload));
}
export async function saveItem(item: OutboxItem) {
  await (
    await database()
  ).runAsync(
    "INSERT OR REPLACE INTO queue (id, owner, payload) VALUES (?, ?, ?)",
    item.id,
    item.owner,
    JSON.stringify(item),
  );
}
export async function removeItem(item: OutboxItem) {
  await (
    await database()
  ).runAsync(
    "DELETE FROM queue WHERE id = ? AND owner = ?",
    item.id,
    item.owner,
  );
  if (item.uri) {
    const f = new File(item.uri);
    if (f.exists) f.delete();
  }
}
export function persistFile(uri: string, id: string) {
  const source = new File(uri);
  const suffix = source.extension || ".bin";
  const dest = new File(Paths.document, `outbox-${id}${suffix}`);
  source.copy(dest);
  return dest.uri;
}
export async function fileBody(uri: string) {
  return new File(uri).bytes();
}
