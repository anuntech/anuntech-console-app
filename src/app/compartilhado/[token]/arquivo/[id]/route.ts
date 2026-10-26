import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { bookmarks } from "@/db/schema";
import { db } from "@/lib/db";
import { downloadUrl } from "@/lib/drive/r2";
import { countDownload, linkByToken, linkFiles, unlockCookieName, unlocked } from "@/lib/drive/share-links";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const back = (token: string, request: Request) => Response.redirect(new URL(`/compartilhado/${token}`, request.url), 303);

/**
 * One file through a download link: the link must still work and be open in
 * this browser, the file must be one the link reaches, and the download is
 * counted (and recorded) before the five-minute signed address.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const link = await linkByToken(token);
  if (!link || link.kind !== "download" || !UUID.test(id)) return new Response(null, { status: 404 });
  if (!unlocked(link, (await cookies()).get(unlockCookieName(link))?.value)) return back(token, request);
  if (!(await linkFiles(link)).some((file) => file.id === id)) return new Response(null, { status: 404 });
  const [file] = await db
    .select({ key: bookmarks.storageKey, fileName: bookmarks.fileName })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), isNull(bookmarks.deletedAt)));
  if (!file?.key || !file.fileName) return new Response(null, { status: 404 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const counted = await countDownload(link, id, ip);
  if (counted === "limit") return new Response("Muitos downloads nesta hora. Tente de novo mais tarde.", { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (!counted) return back(token, request);
  return new Response(null, {
    status: 302,
    headers: { Location: await downloadUrl(file.key, file.fileName), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" },
  });
}
