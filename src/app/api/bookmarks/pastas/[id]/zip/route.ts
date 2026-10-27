import { getActor } from "@/lib/access/access";
import { auditZip, folderZipFor } from "@/lib/drive/folder-zip";
import { zipResponse } from "@/lib/drive/zip-stream";
import { zipRefusal } from "@/lib/drive/zip-rules";

export const runtime = "nodejs";
// The archive is sent as it is built; a big folder on a slow connection takes a while.
export const maxDuration = 800;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plain = (text: string, status: number) => new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });

/** A folder and its subfolders as one .zip, for whoever sees the folder (and only what they see inside). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const folder = await folderZipFor(actor, id);
  if (!folder) return new Response(null, { status: 404 });
  const refusal = zipRefusal(folder.entries);
  if (refusal) return plain(refusal, 413);
  await auditZip(actor.user.id, folder.companyId, id, folder.entries.length);
  return zipResponse(folder.name, folder.entries);
}
