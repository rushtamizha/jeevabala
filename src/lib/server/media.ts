import "server-only";
import { createHash } from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { db } from "@/db";
import { media } from "@/db/schema";
import { ApiError } from "./api";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Accept only real raster images, identified by magic bytes (never by filename or client MIME). */
function sniff(buf: Buffer): "jpeg" | "png" | "webp" | "avif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(4, 12).toString("ascii").startsWith("ftypavi")) return "avif";
  return null;
}

/**
 * Re-encode every upload to WebP: strips EXIF/GPS metadata (privacy), normalises
 * orientation, caps dimensions, and destroys any polyglot/embedded payloads.
 */
export async function storeImage(input: Buffer, opts: { adminId: string; alt?: string; maxSize?: number }) {
  if (input.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "Image is too large (max 8 MB).", "payload_too_large");
  if (!sniff(input)) throw new ApiError(415, "Please upload a JPG, PNG, WebP or AVIF image.", "unsupported_media_type");
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate()
      .resize({ width: opts.maxSize ?? 1920, height: opts.maxSize ?? 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ApiError(422, "This image could not be processed. Try a different file.", "invalid_image");
  }
  const [row] = await db
    .insert(media)
    .values({
      contentType: "image/webp",
      data: out.data,
      size: out.data.length,
      width: out.info.width,
      height: out.info.height,
      sha256: createHash("sha256").update(out.data).digest("hex"),
      alt: opts.alt?.slice(0, 200) ?? null,
      createdBy: opts.adminId,
    })
    .returning({ id: media.id, width: media.width, height: media.height });
  return { id: row.id, url: `/media/${row.id}`, width: row.width, height: row.height };
}
