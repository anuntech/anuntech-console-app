import { appActor } from "@/lib/api/app-request";
import { canAccess } from "@/lib/access/access";
import { loadFolder, saveBookmarkAs, usable } from "@/lib/bookmarks/bookmark-core";
import { indexSoon } from "@/lib/drive/file-index";
import { BOOKMARK_FILE, limitLabel } from "@/lib/tickets/attachment-rules";

export const runtime = "nodejs";
export const maxDuration = 60;
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Room for the form's other fields and the multipart boundaries around the file. */
const ENVELOPE = 64 * 1024;

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: privateHeaders });
}
const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

/**
 * A file bookmark from the app: multipart with `title`, `companyId`,
 * `folderId` and `file`, up to BOOKMARK_FILE (the web's limit), stored like
 * the web's (saveBookmarkAs). The app's session cookie, as /api/v1; a
 * company or folder the person cannot see answers 404, like the procedures,
 * and Anuntech's own space stays on the web.
 */
export async function POST(request: Request) {
  const { actor, response } = await appActor(request);
  if (!actor) {
    const refusal = response ?? fail("Entre novamente para continuar.", 401);
    for (const [name, value] of Object.entries(privateHeaders)) refusal.headers.set(name, value);
    return refusal;
  }
  const tooLarge = `Escolha um arquivo de até ${limitLabel(BOOKMARK_FILE.maxBytes)}.`;
  const length = Number(request.headers.get("content-length") || 0);
  if (length > BOOKMARK_FILE.maxBytes + ENVELOPE) return fail(tooLarge, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Selecione um arquivo para enviar.", 400);
  }
  const folderId = text(form.get("folderId"));
  const companyId = text(form.get("companyId"));
  let owner = UUID.test(companyId) ? companyId : null;
  if (folderId) {
    const folder = UUID.test(folderId) ? await loadFolder(folderId) : null;
    if (!folder || !(await usable(actor, folder))) return fail("Não encontrado.", 404);
    owner = folder.companyId;
  }
  if (!owner || !canAccess(actor, owner, "overview")) return fail("Não encontrado.", 404);
  const result = await saveBookmarkAs(
    actor,
    { title: text(form.get("title")), companyId, folderId, url: "", kind: "file" },
    form.get("file"),
  );
  if (result.error || !result.id) return fail(result.error || "Não foi possível salvar o bookmark. Tente novamente.", 400);
  indexSoon();
  return Response.json({ id: result.id, message: result.success }, { headers: privateHeaders });
}
