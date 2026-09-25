import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Serves re-encoded uploads. Immutable (a new upload gets a new id). */
export async function GET(_req: Request, ctx: RouteContext<"/media/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const [row] = await db.select({ data: media.data, type: media.contentType, sha: media.sha256 }).from(media).where(eq(media.id, id)).limit(1);
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${row.sha.slice(0, 32)}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
