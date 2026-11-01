import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { resolveActor } from "@/lib/access/access";
import { findManagedMailbox } from "@/lib/mail/mail-admin";
import { canManageMail, mobileconfig, mobileconfigFileName } from "@/lib/mail/mail-rules";

const refusal = (status: number) => new Response(null, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * "Baixar perfil para iPhone/Mac": the Apple profile of one managed mailbox,
 * without the password (the device asks for it). Session and access are
 * checked here, and the account is read back from the mail server.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await resolveActor(await headers(), { assisted: true });
  if (!actor) return refusal(401);
  if (!canManageMail(actor)) return refusal(404);
  const { id } = await params;
  let mailbox;
  try {
    mailbox = await findManagedMailbox(id);
  } catch (error) {
    console.error("[email] profile failed", { name: error instanceof Error ? error.name : typeof error });
    return new Response("O servidor de e-mail não respondeu. Tente de novo em alguns minutos.", {
      status: 502,
      headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!mailbox || !canManageMail(actor, mailbox.row.domain)) return refusal(404);
  const body = mobileconfig({ address: mailbox.row.address, name: mailbox.row.name, uuids: [randomUUID(), randomUUID()] });
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-apple-aspen-config",
      "Content-Disposition": `attachment; filename="${mobileconfigFileName(mailbox.row.address)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
