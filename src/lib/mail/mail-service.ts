import "server-only";
import { auditEvents } from "@/db/schema";
import type { Actor } from "../access/access";
import { getAccountEmails } from "../account/account-identity";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { reserveHourly } from "../http/hourly-limit";
import { MailMethodError, MailUnavailable } from "./jmap";
import { MailRefusal, findManagedMailbox, setMailboxPassword } from "./mail-admin";
import type { MailActionState } from "./mail-actions";
import { generatePassword, mailboxAccess, passwordProblem } from "./mail-rules";

/*
 * What the e-mail server actions (mail-actions.ts) share with the app's API
 * (procedures/mail.ts): the person's message for a failure, the audit and
 * the password reset, so the rule is written once.
 */

export const blocked = { error: "Você não tem permissão para fazer isso." };
export const notFound = { error: "Essa caixa não existe mais ou não é gerenciada pelo Console. Atualize a página." };
export const HOURLY = 20;

/** The person's message for whatever the mail server or the database said. */
export function failure(error: unknown, uncertain?: string): ActionState {
  if (error instanceof MailRefusal) return { error: error.message };
  if (error instanceof MailUnavailable) {
    if (error.uncertain && uncertain) return { error: uncertain };
    return { error: "O servidor de e-mail não respondeu. Tente de novo em alguns minutos." };
  }
  if (error instanceof MailMethodError) return { error: "O servidor de e-mail recusou o pedido. Tente de novo em alguns minutos." };
  if (logDatabaseFault("email", error)) return { error: DATABASE_FAILURE };
  console.error("[email] action failed", { name: error instanceof Error ? error.name : typeof error });
  return { error: "Não foi possível concluir agora. Tente de novo em alguns minutos." };
}

/**
 * The change already happened on the mail server: an audit that fails is
 * logged, never undone or hidden from the person. On a client's domain it
 * lands on the company's activity too.
 */
export async function audit(actor: Actor, action: string, entityId: string, details: Record<string, unknown>, companyId: string | null = null) {
  try {
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId, action, entityId, details });
  } catch (error) {
    if (!logDatabaseFault("email audit", error)) console.error("[email] audit failed", { action });
  }
}

/** The new password: generated here (any mode but "type"), or typed and checked. */
export function pickPassword(mode: string, typed: string, local: string): { password: string; generated: boolean } | { error: string } {
  if (mode !== "type") return { password: generatePassword(), generated: true };
  const problem = passwordProblem(typed, { local });
  return problem ? { error: problem } : { password: typed, generated: false };
}

/**
 * A new password for a mailbox: the team and the company's Administrador on
 * any of its mailboxes, a Membro on their own only (mail-rules.ts,
 * mailboxAccess). Anything else, assisted access included, reads as a
 * mailbox that does not exist. A generated password comes back once.
 */
export async function resetPassword(actor: Actor, input: { id: string; mode: string; password?: string }): Promise<MailActionState> {
  if (actor.assisting || (!actor.admin && !actor.grants.length)) return blocked;
  if (!input.id || input.id.length > 255) return notFound;
  try {
    const mailbox = await findManagedMailbox(input.id);
    // The account's e-mails only matter for a Membro's own mailbox.
    const emails = mailbox && !actor.admin ? await getAccountEmails(actor.user.id, actor.user.email) : [];
    if (!mailbox || !mailboxAccess(actor, mailbox.row, emails)) return notFound;
    const secret = pickPassword(input.mode, input.password ?? "", mailbox.row.local);
    if ("error" in secret) return { error: secret.error };
    if (!(await reserveHourly("mail-password", actor.user.id, HOURLY)))
      return { error: `Você chegou ao limite de ${HOURLY} trocas de senha por hora. Tente de novo mais tarde.` };
    await setMailboxPassword(mailbox.row.id, secret.password);
    await audit(
      actor,
      "email.mailbox.password_reset",
      mailbox.row.id,
      { address: mailbox.row.address, generatedPassword: secret.generated },
      mailbox.row.companyId,
    );
    const success = `Senha de ${mailbox.row.address} trocada. Os aplicativos conectados com a senha antiga vão pedir a nova.`;
    return secret.generated ? { success, password: secret.password, address: mailbox.row.address } : { success, address: mailbox.row.address };
  } catch (error) {
    return failure(error);
  }
}
