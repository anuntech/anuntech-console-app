import { headers } from "next/headers";
import { resolveActor } from "@/lib/access/access";
import { sameOrigin } from "@/lib/http/same-origin";
import { reserveHourly } from "@/lib/http/hourly-limit";
import { logDatabaseFault } from "@/lib/action-errors";
import { mailConfigured, MailUnavailable, uploadBlob } from "@/lib/mail/jmap";
import { openMailbox } from "@/lib/mail/mailbox";
import { MAIL_UPLOAD_MAX_BYTES } from "@/lib/mail/mail-rules";

export const runtime = "nodejs";

const headersOut = { "Cache-Control": "private, no-store" };
const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: headersOut });

/** Uploads per person per hour: enough for 200 messages with a few files each. */
const UPLOADS_PER_HOUR = 600;

/**
 * One attachment of a message being written: `POST ?caixa=<address>` with
 * the file's bytes as the body (up to 4 MB, under Vercel's request limit).
 * It goes to the mail server, in the mailbox's account, and the answer is the
 * blobId the send action attaches.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return respond({ error: "O envio foi recusado. Recarregue a página e tente de novo." }, 403);
  const actor = await resolveActor(await headers(), { assisted: true });
  if (!actor) return respond({ error: "Entre de novo para anexar arquivos." }, 401);
  if (!mailConfigured()) return respond({ error: "O e-mail ainda não está configurado neste ambiente." }, 404);
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAIL_UPLOAD_MAX_BYTES) return respond({ error: "Cada anexo pode ter até 4 MB." }, 413);
  const caixa = new URL(request.url).searchParams.get("caixa") ?? "";
  try {
    const mailbox = await openMailbox(actor, caixa);
    if (!mailbox) return respond({ error: "Não encontramos essa caixa de e-mail." }, 404);
    if (!(await reserveHourly("email.upload", actor.user.id, UPLOADS_PER_HOUR)))
      return respond({ error: "Muitos anexos nesta hora. Espere um pouco e tente de novo." }, 429);
    const bytes = await readCapped(request, MAIL_UPLOAD_MAX_BYTES);
    if (!bytes) return respond({ error: "Cada anexo pode ter até 4 MB." }, 413);
    if (!bytes.length) return respond({ error: "O arquivo está vazio." }, 400);
    const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const blob = await uploadBlob(mailbox.accountId, bytes, /^[\w.+-]+\/[\w.+-]+$/.test(type) ? type : "application/octet-stream");
    return respond(blob);
  } catch (error) {
    if (error instanceof MailUnavailable) return respond({ error: "O servidor de e-mail não respondeu. Tente de novo em alguns minutos." }, 502);
    if (logDatabaseFault("email", error)) return respond({ error: "Não foi possível anexar agora. Tente de novo." }, 500);
    throw error;
  }
}

/** The body, or null as soon as it passes `max` bytes (Content-Length can be missing or lie). */
async function readCapped(request: Request, max: number) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
