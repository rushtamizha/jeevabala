import { ApiError, badRequest, route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { MAX_UPLOAD_BYTES, storeImage } from "@/lib/server/media";

/** Multipart image upload (admin only). Same-origin, rate limited, size-capped. */
export const POST = route(
  { auth: "admin", rateLimit: [{ name: "upload", limit: 60, windowSec: 3600, by: "admin" }] },
  async ({ req, admin, ip, userAgent }) => {
    const length = Number(req.headers.get("content-length") ?? "0");
    if (!length || length > MAX_UPLOAD_BYTES + 64 * 1024) throw new ApiError(413, "Image is too large (max 8 MB).", "payload_too_large");
    if (!(req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) throw badRequest("Expected a file upload.");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("No file received.");
    const alt = typeof form.get("alt") === "string" ? String(form.get("alt")) : undefined;
    const kind = form.get("kind") === "avatar" ? "avatar" : "image";
    const stored = await storeImage(Buffer.from(await file.arrayBuffer()), { adminId: admin!.id, alt, maxSize: kind === "avatar" ? 400 : 1920 });
    await audit({ actorType: "ADMIN", actorId: admin!.id, action: "media.upload", entityType: "media", entityId: stored.id, meta: { bytes: file.size }, ip, userAgent });
    return stored;
  },
);
