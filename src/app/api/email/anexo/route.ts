import { headers } from "next/headers";
import { resolveActor } from "@/lib/access/access";
import { downloadBlob, mailConfigured, MailUnavailable } from "@/lib/mail/jmap";
import { openMailbox } from "@/lib/mail/mailbox";
import { isJmapId, safeFileName } from "@/lib/mail/mail-rules";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * An attachment of a message: `?caixa=<address>&blob=<id>&nome=<file name>`.
 * The session and the mailbox are checked on every download; the bytes come
 * straight from the mail server as a stream, always as a download.
 */
export async function GET(request: Request) {
  const actor = await resolveActor(await headers(), { assisted: true });
  if (!actor) return new Response(null, { status: 401, headers: NO_STORE });
  const url = new URL(request.url);
  const caixa = url.searchParams.get("caixa") ?? "";
  const blob = url.searchParams.get("blob") ?? "";
  const name = safeFileName(url.searchParams.get("nome"));
  if (!mailConfigured() || !isJmapId(blob)) return new Response(null, { status: 404, headers: NO_STORE });
  let upstream: Response;
  try {
    const mailbox = await openMailbox(actor, caixa);
    if (!mailbox) return new Response(null, { status: 404, headers: NO_STORE });
    upstream = await downloadBlob(mailbox.accountId, blob, name);
  } catch (error) {
    if (error instanceof MailUnavailable) return new Response(null, { status: error.status === 404 ? 404 : 502, headers: NO_STORE });
    throw error;
  }
  const length = upstream.headers.get("content-length");
  return new Response(upstream.body, {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(length && /^\d+$/.test(length) ? { "Content-Length": length } : {}),
    },
  });
}
