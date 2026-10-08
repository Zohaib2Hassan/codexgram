import { LIMITS } from "./domain";
// Inspect the actual bytes, never trust picker metadata or a client Content-Type.
export function inspectMedia(bytes: Uint8Array): {
  kind: "image" | "video";
  mime: string;
  duration?: number;
} {
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (!bytes.length || bytes.length > LIMITS.videoBytes)
    throw new Error("MEDIA_TOO_LARGE");
  let mime: string | undefined;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    mime = "image/jpeg";
  if (
    bytes.length >= 24 &&
    text(1, 3) === "PNG" &&
    bytes[0] === 137 &&
    text(12, 4) === "IHDR"
  )
    mime = "image/png";
  if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP") mime = "image/webp";
  if (mime) {
    if (bytes.length > LIMITS.imageBytes) throw new Error("IMAGE_TOO_LARGE");
    return { kind: "image", mime };
  }
  if (text(4, 4) !== "ftyp") throw new Error("UNSUPPORTED_MEDIA");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let duration: number | undefined;
  const scan = (start: number, end: number, depth: number) => {
    if (depth > 5) throw new Error("INVALID_VIDEO");
    for (let at = start; at + 8 <= end;) {
      let size = view.getUint32(at);
      const type = text(at + 4, 4);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) throw new Error("INVALID_VIDEO");
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      }
      if (size === 0) size = end - at;
      if (size < header || at + size > end) throw new Error("INVALID_VIDEO");
      const body = at + header;
      if (type === "moov") scan(body, at + size, depth + 1);
      if (type === "mvhd") {
        const version = bytes[body];
        const scaleAt = body + (version === 1 ? 20 : 12);
        if (
          (version !== 0 && version !== 1) ||
          scaleAt + (version === 1 ? 12 : 8) > at + size
        )
          throw new Error("INVALID_VIDEO");
        const scale = view.getUint32(scaleAt);
        const ticks =
          version === 1
            ? Number(view.getBigUint64(scaleAt + 4))
            : view.getUint32(scaleAt + 4);
        duration = scale > 0 ? ticks / scale : NaN;
      }
      at += size;
    }
  };
  scan(0, bytes.length, 0);
  if (!duration || !Number.isFinite(duration) || duration > LIMITS.videoSeconds)
    throw new Error("VIDEO_DURATION_INVALID");
  return { kind: "video", mime: "video/mp4", duration };
}
export function byteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error("INVALID_RANGE");
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end = match[1]
    ? match[2]
      ? Math.min(Number(match[2]), size - 1)
      : size - 1
    : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw new Error("INVALID_RANGE");
  return { start, end };
}
