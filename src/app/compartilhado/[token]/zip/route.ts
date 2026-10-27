import { cookies } from "next/headers";
import { countDownload, linkByToken, linkFiles, unlockCookieName, unlocked } from "@/lib/drive/share-links";
import { shareState } from "@/lib/drive/share-rules";
import { zipResponse } from "@/lib/drive/zip-stream";
import { zipRefusal } from "@/lib/drive/zip-rules";

export const runtime = "nodejs";
export const maxDuration = 800;

const back = (token: string, request: Request) => Response.redirect(new URL(`/compartilhado/${token}`, request.url), 303);

/** Everything a folder link opens, as one .zip; it counts as one download. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await linkByToken(token);
  if (!link || link.kind !== "download" || !link.folderId) return new Response(null, { status: 404 });
  if (shareState(link) !== "active" || !unlocked(link, (await cookies()).get(unlockCookieName(link))?.value)) return back(token, request);
  const files = await linkFiles(link);
  const entries = files.map((f) => ({ id: f.id, fileName: f.fileName!, size: Number(f.fileSize ?? 0), path: f.path }));
  const refusal = zipRefusal(entries);
  if (refusal) return new Response(refusal, { status: 413, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const counted = await countDownload(link, link.folderId, ip);
  if (counted === "limit") return new Response("Muitos downloads nesta hora. Tente de novo mais tarde.", { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (!counted) return back(token, request);
  return zipResponse(link.title, entries);
}
