import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { inspectMedia, byteRange } from "../shared/media";
import type { Id } from "./_generated/dataModel";
const http = httpRouter();
function headers(request: Request) {
  const origin = request.headers.get("Origin");
  const allowed = (process.env.ADMIN_ORIGINS ?? "")
    .split(",")
    .includes(origin ?? "");
  return {
    "Cache-Control": "no-store, private",
    Vary: "Origin",
    ...(allowed && origin ? { "Access-Control-Allow-Origin": origin } : {}),
  };
}
http.route({
  path: "/media",
  method: "OPTIONS",
  handler: httpAction(
    async (_ctx, req) =>
      new Response(null, {
        status: 204,
        headers: {
          ...headers(req),
          "Access-Control-Allow-Headers":
            "Authorization, Content-Type, X-Operation-Id, Range",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Expose-Headers":
            "Content-Range, Accept-Ranges, Content-Length",
        },
      }),
  ),
});
http.route({
  path: "/media",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let stored: Id<"_storage"> | undefined;
    try {
      const operationId = req.headers.get("X-Operation-Id");
      if (!operationId || operationId.length > 100)
        return new Response("INVALID_OPERATION", { status: 400 });
      const auth = await ctx.runMutation(internal.media.authorizeUpload, {
        operationId,
      });
      if (auth.existing)
        return Response.json(
          { mediaId: auth.existing },
          { headers: headers(req) },
        );
      const declared = Number(req.headers.get("Content-Length") ?? 0);
      if (declared > 15_000_000)
        return new Response("MEDIA_TOO_LARGE", { status: 413 });
      const reader = req.body?.getReader();
      if (!reader) return new Response("EMPTY_UPLOAD", { status: 400 });
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.length;
        if (size > 15_000_000) {
          await reader.cancel();
          return new Response("MEDIA_TOO_LARGE", { status: 413 });
        }
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const metadata = inspectMedia(bytes);
      stored = await ctx.storage.store(
        new Blob([bytes], { type: metadata.mime }),
      );
      const mediaId = await ctx.runMutation(internal.media.saveUpload, {
        operationId,
        storageId: stored,
        size,
        ...metadata,
      });
      return Response.json({ mediaId }, { headers: headers(req) });
    } catch (e) {
      if (stored) await ctx.storage.delete(stored);
      const message = e instanceof Error ? e.message : "UPLOAD_FAILED";
      return new Response(
        message.includes("PAUSED") ? "BUDGET_PAUSED" : "UPLOAD_REJECTED",
        {
          status: message.includes("PAUSED") ? 429 : 400,
          headers: headers(req),
        },
      );
    }
  }),
});
http.route({
  path: "/media",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const id = new URL(req.url).searchParams.get("id");
      if (!id) return new Response(null, { status: 404 });
      const media = await ctx.runQuery(internal.media.access, {
        id: id as Id<"media">,
      });
      const blob = await ctx.storage.get(media.storageId);
      if (!blob) return new Response(null, { status: 404 });
      let range;
      try {
        range = byteRange(req.headers.get("Range"), blob.size);
      } catch {
        return new Response(null, {
          status: 416,
          headers: { ...headers(req), "Content-Range": `bytes */${blob.size}` },
        });
      }
      const common = {
        ...headers(req),
        "Content-Type": media.mime,
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Expose-Headers":
          "Content-Range, Accept-Ranges, Content-Length",
      };
      if (range)
        return new Response(blob.slice(range.start, range.end + 1), {
          status: 206,
          headers: {
            ...common,
            "Content-Length": String(range.end - range.start + 1),
            "Content-Range": `bytes ${range.start}-${range.end}/${blob.size}`,
          },
        });
      return new Response(blob, {
        headers: { ...common, "Content-Length": String(blob.size) },
      });
    } catch {
      return new Response("MEDIA_UNAVAILABLE", {
        status: 403,
        headers: headers(req),
      });
    }
  }),
});
http.route({
  path: "/evidence",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const id = new URL(req.url).searchParams.get("id");
      if (!id) return new Response(null, { status: 404 });
      const r = await ctx.runQuery(internal.admin.evidence, {
        id: id as Id<"reports">,
      });
      const blob = r.storageId ? await ctx.storage.get(r.storageId) : null;
      if (!blob) return new Response(null, { status: 404 });
      const range = byteRange(req.headers.get("Range"), blob.size);
      return new Response(
        range ? blob.slice(range.start, range.end + 1) : blob,
        {
          status: range ? 206 : 200,
          headers: {
            ...headers(req),
            "Content-Type": r.mime ?? "application/octet-stream",
            "Accept-Ranges": "bytes",
            ...(range
              ? {
                  "Content-Range": `bytes ${range.start}-${range.end}/${blob.size}`,
                }
              : {}),
          },
        },
      );
    } catch {
      return new Response(null, { status: 403, headers: headers(req) });
    }
  }),
});
http.route({
  path: "/evidence",
  method: "OPTIONS",
  handler: httpAction(
    async (_ctx, req) =>
      new Response(null, {
        status: 204,
        headers: {
          ...headers(req),
          "Access-Control-Allow-Headers": "Authorization, Range",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      }),
  ),
});
export default http;
