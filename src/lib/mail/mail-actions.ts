"use server";
import { z } from "zod";
import { auditEvents } from "@/db/schema";
import { getActor, type Actor } from "../access/access";
import { getAccountEmails } from "../account/account-identity";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { reserveHourly } from "../http/hourly-limit";
import { MailMethodError, MailUnavailable } from "./jmap";
import {
  MailRefusal,
  createForward as createForwardOnServer,
  createMailbox as createMailboxOnServer,
  deleteForward as deleteForwardOnServer,
  deleteMailbox as deleteMailboxOnServer,
  findManagedForward,
  findManagedMailbox,
  setMailboxPassword,
  updateForward as updateForwardOnServer,
  updateMailbox as updateMailboxOnServer,
} from "./mail-admin";
import {
  FORWARD_RECIPIENTS_MAX,
  canManageMail,
  generatePassword,
  isMailDomain,
  localPartProblem,
  normalizeLocalPart,
  parseQuota,
  parseRecipients,
  passwordProblem,
  storageLabel,
} from "./mail-rules";

/*
 * The e-mail area's server actions (only the Anuntech team in phase 1). Each
 * one starts with getActor() and `canManageMail`, reads the record back from
 * the mail server before changing it (lib/mail/mail-admin.ts) and writes
 * `audit_events` after the server confirmed: the change lives on another
 * system, so there is no transaction to share. A password never reaches the
 * audit, the logs or the database; a generated one comes back once, in the
 * action's answer, for the sheet to show.
 */

/** What a create or a reset answers: the generated password, shown once. */
export type MailActionState = ActionState & { password?: string; address?: string };

const blocked = { error: "Você não tem permissão para fazer isso." };
const notFound = { error: "Essa caixa não existe mais ou não é gerenciada pelo Console. Atualize a página." };
const HOURLY = 20;

/** The person's message for whatever the mail server or the database said. */
function failure(error: unknown, uncertain?: string): ActionState {
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

/** The change already happened on the mail server: an audit that fails is logged, never undone or hidden from the person. */
async function audit(actor: Actor, action: string, entityId: string, details: Record<string, unknown>) {
  try {
    await db.insert(auditEvents).values({ actorId: actor.user.id, action, entityId, details });
  } catch (error) {
    if (!logDatabaseFault("email audit", error)) console.error("[email] audit failed", { action });
  }
}

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};
const nameInput = z.string().trim().max(120);
const idInput = z.string().min(1).max(255);

/** The new password: generated here, or typed and checked. */
function choosePassword(form: FormData, local: string): { password: string; generated: boolean } | { error: string } {
  if (field(form, "mode") !== "type") return { password: generatePassword(), generated: true };
  const password = field(form, "password");
  const problem = passwordProblem(password, { local });
  return problem ? { error: problem } : { password, generated: false };
}

export async function createMailbox(_: ActionState, form: FormData): Promise<MailActionState> {
  const actor = await getActor();
  const domain = field(form, "domain").trim().toLowerCase();
  if (!canManageMail(actor, domain) || !isMailDomain(domain)) return blocked;
  const local = normalizeLocalPart(field(form, "local"), domain);
  const problem = localPartProblem(local);
  if (problem) return { error: problem };
  const name = nameInput.safeParse(field(form, "name"));
  if (!name.success) return { error: "Use até 120 caracteres no nome." };
  const quota = parseQuota(field(form, "quota"));
  if (!quota) return { error: "Escolha o espaço da caixa." };
  const secret = choosePassword(form, local);
  if ("error" in secret) return { error: secret.error };
  try {
    if (!(await reserveHourly("mail-create", actor.user.id, HOURLY)))
      return { error: `Você chegou ao limite de ${HOURLY} caixas criadas por hora. Tente de novo mais tarde.` };
    const created = await createMailboxOnServer({ domain, local, name: name.data || null, quotaBytes: quota, password: secret.password });
    await audit(actor, "email.mailbox.created", created.id, {
      address: created.address,
      quota: storageLabel(quota),
      generatedPassword: secret.generated,
    });
    return secret.generated
      ? { success: `Caixa ${created.address} criada.`, password: secret.password, address: created.address }
      : { success: `Caixa ${created.address} criada.` };
  } catch (error) {
    return failure(error, "O servidor de e-mail não confirmou a criação. Atualize a página e confira se a caixa apareceu antes de tentar de novo.");
  }
}

export async function resetMailboxPassword(_: ActionState, form: FormData): Promise<MailActionState> {
  const actor = await getActor();
  if (!canManageMail(actor)) return blocked;
  const id = idInput.safeParse(field(form, "id"));
  if (!id.success) return notFound;
  try {
    const mailbox = await findManagedMailbox(id.data);
    if (!mailbox || !canManageMail(actor, mailbox.row.domain)) return notFound;
    const secret = choosePassword(form, mailbox.row.local);
    if ("error" in secret) return { error: secret.error };
    if (!(await reserveHourly("mail-password", actor.user.id, HOURLY)))
      return { error: `Você chegou ao limite de ${HOURLY} trocas de senha por hora. Tente de novo mais tarde.` };
    await setMailboxPassword(mailbox.row.id, secret.password);
    await audit(actor, "email.mailbox.password_reset", mailbox.row.id, { address: mailbox.row.address, generatedPassword: secret.generated });
    const success = `Senha de ${mailbox.row.address} trocada. Os aplicativos conectados com a senha antiga vão pedir a nova.`;
    return secret.generated ? { success, password: secret.password, address: mailbox.row.address } : { success };
  } catch (error) {
    return failure(error);
  }
}

export async function updateMailbox(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!canManageMail(actor)) return blocked;
  const id = idInput.safeParse(field(form, "id"));
  if (!id.success) return notFound;
  const name = nameInput.safeParse(field(form, "name"));
  if (!name.success) return { error: "Use até 120 caracteres no nome." };
  const quotaField = field(form, "quota");
  const quota = quotaField === "keep" ? undefined : parseQuota(quotaField);
  if (quota === null) return { error: "Escolha o espaço da caixa." };
  const aliases = form
    .getAll("alias")
    .filter((value): value is string => typeof value === "string")
    .slice(0, 50);
  try {
    const mailbox = await findManagedMailbox(id.data);
    if (!mailbox || !canManageMail(actor, mailbox.row.domain)) return notFound;
    const locals = aliases.map((alias) => normalizeLocalPart(alias, mailbox.row.domain)).filter(Boolean);
    const { aliasesChanged } = await updateMailboxOnServer(mailbox, { name: name.data || null, quotaBytes: quota, aliases: locals });
    await audit(actor, "email.mailbox.updated", mailbox.row.id, {
      address: mailbox.row.address,
      ...(quota !== undefined && quota !== mailbox.row.quotaBytes ? { quota: storageLabel(quota) } : {}),
      ...(aliasesChanged ? { aliases: [...new Set(locals)].map((local) => `${local}@${mailbox.row.domain}`) } : {}),
    });
    return { success: `Caixa ${mailbox.row.address} salva.` };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMailbox(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!canManageMail(actor)) return blocked;
  const id = idInput.safeParse(field(form, "id"));
  if (!id.success) return notFound;
  try {
    const mailbox = await findManagedMailbox(id.data);
    if (!mailbox || !canManageMail(actor, mailbox.row.domain)) return notFound;
    if (field(form, "confirm").trim().toLowerCase() !== mailbox.row.address)
      return { error: `Para excluir, digite o endereço completo: ${mailbox.row.address}.` };
    const emails = await getAccountEmails(actor.user.id, actor.user.email);
    const addresses = [mailbox.row.address, ...mailbox.row.aliases.map((alias) => `${alias}@${mailbox.row.domain}`)];
    const own = addresses.some((address) => emails.includes(address));
    if (own && field(form, "own") !== "on")
      return { error: "Esta é a sua própria caixa. Marque que entende que vai perder os e-mails e o acesso a ela." };
    await deleteMailboxOnServer(mailbox.row.id);
    await audit(actor, "email.mailbox.deleted", mailbox.row.id, { address: mailbox.row.address, own });
    return { success: `Caixa ${mailbox.row.address} excluída. Os e-mails dela estão sendo apagados no servidor.` };
  } catch (error) {
    return failure(error);
  }
}

/** The destinations typed in the form: one per line or separated by commas. */
function recipientsOf(form: FormData): { recipients: string[] } | { error: string } {
  const { valid, invalid } = parseRecipients(field(form, "recipients").slice(0, 10_000));
  if (invalid.length) return { error: `${invalid.slice(0, 3).join(", ")} não ${invalid.length === 1 ? "é um endereço" : "são endereços"} de e-mail.` };
  if (!valid.length) return { error: "Digite pelo menos um destino." };
  if (valid.length > FORWARD_RECIPIENTS_MAX) return { error: `Use até ${FORWARD_RECIPIENTS_MAX} destinos.` };
  return { recipients: valid };
}

export async function createForward(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const domain = field(form, "domain").trim().toLowerCase();
  if (!canManageMail(actor, domain) || !isMailDomain(domain)) return blocked;
  const local = normalizeLocalPart(field(form, "local"), domain);
  const problem = localPartProblem(local);
  if (problem) return { error: problem };
  const name = nameInput.safeParse(field(form, "name"));
  if (!name.success) return { error: "Use até 120 caracteres na descrição." };
  const parsed = recipientsOf(form);
  if ("error" in parsed) return parsed;
  try {
    const created = await createForwardOnServer({ domain, local, name: name.data || null, recipients: parsed.recipients });
    await audit(actor, "email.forward.created", created.id, { address: created.address, recipients: parsed.recipients });
    return { success: `Redirecionamento ${created.address} criado.` };
  } catch (error) {
    return failure(error, "O servidor de e-mail não confirmou a criação. Atualize a página e confira antes de tentar de novo.");
  }
}

export async function updateForward(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!canManageMail(actor)) return blocked;
  const id = idInput.safeParse(field(form, "id"));
  if (!id.success) return notFound;
  const name = nameInput.safeParse(field(form, "name"));
  if (!name.success) return { error: "Use até 120 caracteres na descrição." };
  const parsed = recipientsOf(form);
  if ("error" in parsed) return parsed;
  try {
    const forward = await findManagedForward(id.data);
    if (!forward || !canManageMail(actor, forward.domain)) return { error: "Esse redirecionamento não existe mais. Atualize a página." };
    await updateForwardOnServer(forward, { name: name.data || null, recipients: parsed.recipients });
    await audit(actor, "email.forward.updated", forward.id, { address: forward.address, recipients: parsed.recipients });
    return { success: `Redirecionamento ${forward.address} salvo.` };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteForward(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!canManageMail(actor)) return blocked;
  const id = idInput.safeParse(field(form, "id"));
  if (!id.success) return { error: "Esse redirecionamento não existe mais. Atualize a página." };
  try {
    const forward = await findManagedForward(id.data);
    if (!forward || !canManageMail(actor, forward.domain)) return { error: "Esse redirecionamento não existe mais. Atualize a página." };
    await deleteForwardOnServer(forward.id);
    await audit(actor, "email.forward.deleted", forward.id, { address: forward.address });
    return { success: `Redirecionamento ${forward.address} excluído.` };
  } catch (error) {
    return failure(error);
  }
}
