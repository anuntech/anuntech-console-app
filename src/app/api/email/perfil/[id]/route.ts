import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { resolveActor } from "@/lib/access/access";
import { getAccountEmails } from "@/lib/account/account-identity";
import { findManagedMailbox } from "@/lib/mail/mail-admin";
import { mailboxAccess, mobileconfig, mobileconfigFileName } from "@/lib/mail/mail-rules";

const refusal = (status: number) => new Response(null, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * "Baixar perfil para iPhone/Mac": the Apple profile of one managed mailbox,
 * without the password (the device asks for it). Session and access are
 * checked here, and the account is read back from the mail server: the team,
 * the company's Administrador or the Membro whose mailbox it is. Anything
 * else, assisted access included, answers 404 like a mailbox that does not
 * exist. The app downloads it with its session too.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await resolveActor(await headers(), { assisted: true });
  if (!actor) return refusal(401);
  if (actor.assisting || (!actor.admin && !actor.grants.length)) return refusal(404);
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
  if (!mailbox) return refusal(404);
  const emails = actor.admin ? [] : await getAccountEmails(actor.user.id, actor.user.email);
  if (!mailboxAccess(actor, mailbox.row, emails)) return refusal(404);
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
