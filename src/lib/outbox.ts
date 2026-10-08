export type OutboxItem = {
  id: string;
  owner: string;
  kind: "post" | "message";
  text: string;
  conversationId?: string;
  postId?: string;
  uri?: string;
  mime?: string;
  mediaId?: string;
  state: "pending" | "sending" | "failed" | "paused";
  error?: string;
  attempts: number;
  nextAt: number;
};
export function restored(items: OutboxItem[]) {
  return items.map((i) =>
    i.state === "sending" ? { ...i, state: "pending" as const } : i,
  );
}
export function afterFailure(item: OutboxItem, error: string): OutboxItem {
  const paused = /PAUSED|QUOTA/.test(error);
  const permanent =
    /READ_ONLY|SUSPENDED|NOT_FOUND|UNAVAILABLE|REJECTED|INVALID|MISMATCH/.test(
      error,
    );
  const attempts = item.attempts + 1;
  return {
    ...item,
    attempts,
    state: paused
      ? "paused"
      : permanent || attempts >= 4
        ? "failed"
        : "pending",
    error: paused
      ? "limit"
      : /REJECTED|INVALID_MEDIA/.test(error)
        ? "media"
        : permanent
          ? "permission"
          : "connection",
    nextAt: Date.now() + Math.min(60000, 2000 * 2 ** attempts),
  };
}
