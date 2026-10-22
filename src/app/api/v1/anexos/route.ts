import { eq } from "drizzle-orm";
import { engagements } from "@/db/schema";
import { appActor } from "@/lib/api/app-request";
import { canAccess, canSeeEngagement, type Actor } from "@/lib/access/access";
import { logDatabaseFault } from "@/lib/action-errors";
import { db } from "@/lib/db";
import { DOCUMENT_ATTACHMENTS, limitLabel } from "@/lib/tickets/attachment-rules";
import { MAX_TICKET_BYTES } from "@/lib/tickets/ticket-files";
import { appendTicketUpload, discardTicketUpload, stageTicketUpload } from "@/lib/tickets/ticket-uploads";

export const runtime = "nodejs";
export const maxDuration = 60;
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
/** One request carries at most this much: Vercel takes bodies up to 4.5 MB. Bigger files go in parts. */
const PART_BYTES = 4 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = "Envie um PDF ou uma imagem PNG, JPEG ou WebP válida.";

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: privateHeaders });
}
const answer = (data: unknown) => Response.json(data, { headers: privateHeaders });

/** The person, or the refusal (401 without a session, 403 from another site). */
async function person(request: Request) {
  const { actor, response } = await appActor(request);
  if (actor) return { actor } as const;
  const refusal = response ?? fail("Entre novamente para continuar.", 401);
  for (const [name, value] of Object.entries(privateHeaders)) refusal.headers.set(name, value);
  return { refusal } as const;
}

/**
 * Where the file is going, from the query: a ticket of a company
 * (`?para=chamado&empresa=<id>`, support area) or a task of a project
 * (`?para=tarefa&projeto=<id>`, the project as the person sees it). Out of
 * reach answers 404, as the API does.
 */
async function targetAllowed(actor: Actor, query: URLSearchParams) {
  const kind = query.get("para");
  if (kind === "chamado") {
    const companyId = query.get("empresa") ?? "";
    return uuid.test(companyId) && canAccess(actor, companyId, "support");
  }
  if (kind === "tarefa") {
    const engagementId = query.get("projeto") ?? "";
    if (!uuid.test(engagementId)) return false;
    const [project] = await db
      .select({ id: engagements.id, companyId: engagements.companyId })
      .from(engagements)
      .where(eq(engagements.id, engagementId));
    return !!project && canSeeEngagement(actor, project);
  }
  return false;
}

/** The body, refused past `max` bytes (null) without reading the rest. */
async function readPart(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

const failure = (error: unknown) =>
  fail(
    error instanceof Error && error.message && !logDatabaseFault("app uploads", error)
      ? error.message
      : "O envio do anexo falhou. Tente de novo.",
    400,
  );

/** What the app gets after a part: the finished file, or how much arrived. */
const progress = (uploadId: string, result: Awaited<ReturnType<typeof appendTicketUpload>>) =>
  result.file ? answer({ uploadId, ...result.file }) : answer({ uploadId, received: result.received });

/**
 * A file for a ticket or a task, sent by the app before the reply, the
 * ticket or the comment that uses it (the web stages its files through
 * /api/chamados/uploads, which takes only its own pages). The body is the
 * raw file (Content-Type says which; PDF, PNG, JPEG or WebP), the name goes
 * URL-encoded in X-File-Name. A file larger than one request sends its total
 * in X-File-Size and the first part here, the rest with PATCH. Same limits
 * and checks as the web (lib/tickets/ticket-uploads.ts); the answer, once
 * complete, is { uploadId, name, size, mime } for tickets.reply,
 * tickets.create and the tasks.
 */
export async function POST(request: Request) {
  const { actor, refusal } = await person(request);
  if (!actor) return refusal;
  let name = "";
  try {
    name = decodeURIComponent(request.headers.get("x-file-name") ?? "").trim();
  } catch {
    name = "";
  }
  if (!name || name.length > 255) return fail("Selecione o arquivo de novo.", 400);
  if (!(await targetAllowed(actor, new URL(request.url).searchParams))) return fail("Não encontrado.", 404);
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!DOCUMENT_ATTACHMENTS.accept?.includes(type)) return fail(KINDS, 415);
  const size = Number(request.headers.get("x-file-size") || request.headers.get("content-length") || 0);
  if (!Number.isSafeInteger(size) || size < 1) return fail("Arquivo vazio.", 400);
  if (size > MAX_TICKET_BYTES) return fail(`Escolha um arquivo de até ${limitLabel(MAX_TICKET_BYTES)}.`, 413);
  const part = await readPart(request, Math.min(size, PART_BYTES));
  if (!part) return fail("Parte excede o limite.", 413);
  if (!part.length) return fail("Arquivo vazio.", 400);
  let uploadId: string;
  try {
    uploadId = await stageTicketUpload(actor.user.id, { name, size });
  } catch {
    // The web's words for any refusal at this step.
    return fail("Não foi possível iniciar o envio. Use arquivos de até 20 MB e tente novamente.", 400);
  }
  try {
    return progress(uploadId, await appendTicketUpload(actor.user.id, { id: uploadId, offset: 0, part }));
  } catch (error) {
    await discardTicketUpload(actor.user.id, uploadId).catch(() => undefined);
    return failure(error);
  }
}

/** The next part of a file started with POST: ?id=<uploadId>&offset=<bytes already sent>. */
export async function PATCH(request: Request) {
  const { actor, refusal } = await person(request);
  if (!actor) return refusal;
  const query = new URL(request.url).searchParams,
    id = query.get("id") ?? "",
    offset = Number(query.get("offset"));
  if (!uuid.test(id) || !Number.isSafeInteger(offset) || offset < 1)
    return fail("Não foi possível continuar o envio. Selecione o arquivo de novo.", 400);
  const part = await readPart(request, PART_BYTES);
  if (!part) return fail("Parte excede o limite.", 413);
  if (!part.length) return fail("Arquivo vazio.", 400);
  try {
    return progress(id, await appendTicketUpload(actor.user.id, { id, offset, part }));
  } catch (error) {
    return failure(error);
  }
}

/** A file removed before sending: ?id=<uploadId>. Only the person's own. */
export async function DELETE(request: Request) {
  const { actor, refusal } = await person(request);
  if (!actor) return refusal;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (uuid.test(id)) await discardTicketUpload(actor.user.id, id);
  return answer({ ok: true });
}
