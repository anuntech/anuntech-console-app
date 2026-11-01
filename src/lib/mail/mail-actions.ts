"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, companies, mailDomains } from "@/db/schema";
import { getActor, type Actor } from "../access/access";
import { getAccountEmails } from "../account/account-identity";
import { DATABASE_FAILURE, databaseFault, logDatabaseFault } from "../action-errors";
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
  serverHasDomain,
  setMailboxPassword,
  updateForward as updateForwardOnServer,
  updateMailbox as updateMailboxOnServer,
} from "./mail-admin";
import {
  FORWARD_RECIPIENTS_MAX,
  canManageMail,
  generatePassword,
  isAnuntechDomain,
  localPartProblem,
  normalizeLocalPart,
  normalizeMailDomain,
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
 * action's answer, for the sheet to show. Linking a domain to a client lives
 * in the database only, so it and its audit share a transaction.
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

/**
 * The change already happened on the mail server: an audit that fails is
 * logged, never undone or hidden from the person. On a client's domain it
 * lands on the company's activity too.
 */
async function audit(actor: Actor, action: string, entityId: string, details: Record<string, unknown>, companyId: string | null = null) {
  try {
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId, action, entityId, details });
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
  if (!canManageMail(actor)) return blocked;
  // Whether the Console manages it is the server side's answer (mail-admin.ts), not the form's.
  const domain = normalizeMailDomain(field(form, "domain"));
  if (!domain) return { error: "Escolha o domínio da caixa." };
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
    await audit(
      actor,
      "email.mailbox.created",
      created.id,
      { address: created.address, quota: storageLabel(quota), generatedPassword: secret.generated },
      created.companyId,
    );
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
    if (!mailbox) return notFound;
    const secret = choosePassword(form, mailbox.row.local);
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
    if (!mailbox) return notFound;
    const locals = aliases.map((alias) => normalizeLocalPart(alias, mailbox.row.domain)).filter(Boolean);
    const { aliasesChanged } = await updateMailboxOnServer(mailbox, { name: name.data || null, quotaBytes: quota, aliases: locals });
    await audit(
      actor,
      "email.mailbox.updated",
      mailbox.row.id,
      {
        address: mailbox.row.address,
        ...(quota !== undefined && quota !== mailbox.row.quotaBytes ? { quota: storageLabel(quota) } : {}),
        ...(aliasesChanged ? { aliases: [...new Set(locals)].map((local) => `${local}@${mailbox.row.domain}`) } : {}),
      },
      mailbox.row.companyId,
    );
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
    if (!mailbox) return notFound;
    if (field(form, "confirm").trim().toLowerCase() !== mailbox.row.address)
      return { error: `Para excluir, digite o endereço completo: ${mailbox.row.address}.` };
    const emails = await getAccountEmails(actor.user.id, actor.user.email);
    const addresses = [mailbox.row.address, ...mailbox.row.aliases.map((alias) => `${alias}@${mailbox.row.domain}`)];
    const own = addresses.some((address) => emails.includes(address));
    if (own && field(form, "own") !== "on")
      return { error: "Esta é a sua própria caixa. Marque que entende que vai perder os e-mails e o acesso a ela." };
    await deleteMailboxOnServer(mailbox.row.id);
    await audit(actor, "email.mailbox.deleted", mailbox.row.id, { address: mailbox.row.address, own }, mailbox.row.companyId);
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
  if (!canManageMail(actor)) return blocked;
  const domain = normalizeMailDomain(field(form, "domain"));
  if (!domain) return { error: "Escolha o domínio do redirecionamento." };
  const local = normalizeLocalPart(field(form, "local"), domain);
  const problem = localPartProblem(local);
  if (problem) return { error: problem };
  const name = nameInput.safeParse(field(form, "name"));
  if (!name.success) return { error: "Use até 120 caracteres na descrição." };
  const parsed = recipientsOf(form);
  if ("error" in parsed) return parsed;
  try {
    const created = await createForwardOnServer({ domain, local, name: name.data || null, recipients: parsed.recipients });
    await audit(actor, "email.forward.created", created.id, { address: created.address, recipients: parsed.recipients }, created.companyId);
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
    if (!forward) return { error: "Esse redirecionamento não existe mais. Atualize a página." };
    await updateForwardOnServer(forward, { name: name.data || null, recipients: parsed.recipients });
    await audit(actor, "email.forward.updated", forward.id, { address: forward.address, recipients: parsed.recipients }, forward.companyId);
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
    if (!forward) return { error: "Esse redirecionamento não existe mais. Atualize a página." };
    await deleteForwardOnServer(forward.id);
    await audit(actor, "email.forward.deleted", forward.id, { address: forward.address }, forward.companyId);
    return { success: `Redirecionamento ${forward.address} excluído.` };
  } catch (error) {
    return failure(error);
  }
}

// Domains ---------------------------------------------------------------

const DOMAIN_LINKED = "console_mail_domains_domain_unique";
const companyInput = z.string().uuid();

/**
 * Links a domain the server already has to a client: from then on its
 * mailboxes and forwards are managed here. Anuntech's domains and the mail
 * infrastructure's are never a client's. Creating a domain on the server
 * (DKIM keys, certificates) stays with whoever runs it, for now.
 */
export async function linkMailDomain(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!canManageMail(actor)) return blocked;
  const company = companyInput.safeParse(field(form, "companyId"));
  if (!company.success) return { error: "Escolha a empresa." };
  const domain = normalizeMailDomain(field(form, "domain"));
  if (!domain) return { error: "Escolha um domínio do servidor de e-mail." };
  if (isAnuntechDomain(domain)) return { error: "Os domínios da Anuntech não são vinculados a clientes." };
  try {
    const [client] = await db.select({ id: companies.id, name: companies.name, archived: companies.archived }).from(companies).where(eq(companies.id, company.data));
    if (!client) return { error: "Escolha a empresa." };
    if (client.archived) return { error: `${client.name} está arquivada. Reative a empresa antes de vincular o domínio.` };
    if (!(await serverHasDomain(domain)))
      return { error: `O domínio ${domain} ainda não está no servidor de e-mail. Peça a quem administra o servidor para criá-lo e tente de novo.` };
    await db.transaction(async (tx) => {
      const [link] = await tx.insert(mailDomains).values({ companyId: client.id, domain, actorId: actor.user.id }).returning({ id: mailDomains.id });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: client.id,
        action: "email.domain.linked",
        entityId: link.id,
        details: { domain, company: client.name },
      });
    });
    return { success: `${domain} vinculado a ${client.name}.` };
  } catch (error) {
    const fault = databaseFault(error);
    if (fault?.code === "23505" && fault.constraint === DOMAIN_LINKED) return { error: `O domínio ${domain} já está vinculado a uma empresa.` };
    return failure(error);
  }
}

/** Unlinks a client's domain: its mailboxes stay on the server, untouched, and leave the Console. */
export async function unlinkMailDomain(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!canManageMail(actor)) return blocked;
  const id = z.string().uuid().safeParse(field(form, "id"));
  const gone = { error: "Esse domínio não está mais vinculado. Atualize a página." };
  if (!id.success) return gone;
  try {
    const [link] = await db
      .select({ id: mailDomains.id, domain: mailDomains.domain, companyId: mailDomains.companyId, company: companies.name })
      .from(mailDomains)
      .innerJoin(companies, eq(companies.id, mailDomains.companyId))
      .where(eq(mailDomains.id, id.data));
    if (!link) return gone;
    if (field(form, "confirm").trim().toLowerCase() !== link.domain) return { error: `Para desvincular, digite o domínio: ${link.domain}.` };
    const removed = await db.transaction(async (tx) => {
      const [row] = await tx.delete(mailDomains).where(eq(mailDomains.id, link.id)).returning({ id: mailDomains.id });
      if (!row) return false;
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: link.companyId,
        action: "email.domain.unlinked",
        entityId: link.id,
        details: { domain: link.domain, company: link.company },
      });
      return true;
    });
    if (!removed) return gone;
    return { success: `${link.domain} desvinculado de ${link.company}. As caixas continuam no servidor de e-mail.` };
  } catch (error) {
    return failure(error);
  }
}
