"use server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, catalogItems, companies, engagements, mailDomainClaims, mailDomains } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { currency } from "../format";
import { reserveHourly } from "../http/hourly-limit";
import { sendOpsMail } from "../notifications/ops-alerts";
import { dnsHealth, domainOwner } from "./mail-admin";
import {
  addableDomainProblem,
  canManageMail,
  domainAddRefusal,
  mailContractRefusal,
  mailRole,
  normalizeMailDomain,
  ownershipToken,
} from "./mail-rules";
import { blocked, failure } from "./mail-service";
import { claimById, claimCheck, companyStanding, establishDomain, mailProduct } from "./mail-setup";

/*
 * The client's own setup of the e-mail (lib/mail/mail-setup.ts): contracting
 * the product, adding a domain, proving it and checking the DNS again. Each
 * action starts with getActor() and checks the person against the company
 * (mailRole: the team, or the company's Administrador; assisted access never),
 * whatever the form says. Another company reads like one that does not exist.
 */

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};
const uuid = z.uuid();
const gone = { error: "Essa empresa não existe ou não está ao seu alcance." };
const claimGone = { error: "Esse domínio não está mais esperando a confirmação. Atualize a página." };
/** Contracting, adding domains and asking the DNS, per person and hour: enough for a real setup, not for a loop. */
const SETUP_HOURLY = 30;
const consoleUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://console.anuntech.com";

/**
 * "Contratar e-mail": the company's Administrador picks the catalog's
 * e-mail item and the product starts at once, with the catalog's price, for
 * a company in good standing. Nothing is billed here (Kauan, 01/11/2026): the
 * team gets an e-mail and bills it as every other product.
 */
export async function contractMail(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (actor.assisting) return blocked;
  const companyId = uuid.safeParse(field(form, "companyId"));
  const itemId = uuid.safeParse(field(form, "catalogItemId"));
  if (!companyId.success) return gone;
  const role = mailRole(actor, companyId.data);
  if (!role) return gone;
  if (!itemId.success) return { error: "Escolha o plano de e-mail." };
  try {
    if (!(await reserveHourly("mail-setup", actor.user.id, SETUP_HOURLY))) return { error: "Muitas tentativas nesta hora. Tente de novo mais tarde." };
    const [company] = await db.select({ id: companies.id, name: companies.name, archived: companies.archived }).from(companies).where(eq(companies.id, companyId.data));
    if (!company) return gone;
    const [item] = await db
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.id, itemId.data), eq(catalogItems.active, true), eq(catalogItems.kind, "product"), eq(catalogItems.suspensionKind, "email")));
    if (!item) return { error: "Esse plano de e-mail não está mais disponível. Atualize a página." };
    const standing = await companyStanding(company.id);
    const result = await db.transaction(async (tx) => {
      // Two tabs or a double click: the company row is locked and the product read again inside.
      await tx.select({ id: companies.id }).from(companies).where(eq(companies.id, company.id)).for("update");
      const refusal = mailContractRefusal({ role, archived: company.archived, product: (await mailProduct(company.id, tx)).state, ...standing });
      if (refusal) return { refusal };
      const [row] = await tx
        .insert(engagements)
        .values({
          companyId: company.id,
          kind: "product",
          name: item.name,
          description: item.description,
          url: item.url,
          catalogItemId: item.id,
          amountCents: item.defaultAmountCents,
        })
        .returning({ id: engagements.id });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: company.id,
        action: "engagement.created",
        entityId: row.id,
        details: { catalogItemId: item.id, contractedBy: role === "manager" ? "client" : "team" },
      });
      return { id: row.id };
    });
    if ("refusal" in result) return { error: result.refusal };
    if (role === "manager") {
      const price = item.defaultAmountCents ? `${currency(item.defaultAmountCents)} ${item.interval === "yearly" ? "por ano" : "por mês"}` : "sem preço no catálogo";
      // Best effort: the product exists either way, and the company's activity shows it too.
      await sendOpsMail(
        `E-mail contratado: ${company.name}`,
        [
          `${actor.user.name || actor.user.email} contratou ${item.name} para ${company.name} pelo Console (${price}).`,
          "O produto já está ativo e o cliente pode adicionar o domínio. Nada foi cobrado: crie a cobrança como de costume.",
          `${consoleUrl()}/produtos?q=${encodeURIComponent(item.name)}`,
        ].join("\n\n"),
      );
    }
    return { success: `${item.name} contratado. Agora adicione o domínio da empresa.`, href: `/email?empresa=${company.id}` };
  } catch (error) {
    return failure(error);
  }
}

/**
 * "Adicionar domínio": a domain waits for the proof (the _anuntech TXT) and
 * nothing goes to the server yet. A domain already on the server under
 * another company stays theirs; one of this company's opens its page.
 */
export async function addMailDomain(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (actor.assisting) return blocked;
  const companyId = uuid.safeParse(field(form, "companyId"));
  if (!companyId.success) return gone;
  const role = mailRole(actor, companyId.data);
  if (!role) return gone;
  const domain = normalizeMailDomain(field(form, "domain").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, ""));
  const problem = addableDomainProblem(domain);
  if (problem || !domain) return { error: problem ?? "Digite o domínio." };
  const page = `/email/dns?dominio=${encodeURIComponent(domain)}&empresa=${companyId.data}`;
  try {
    if (!(await reserveHourly("mail-setup", actor.user.id, SETUP_HOURLY))) return { error: "Muitas tentativas nesta hora. Tente de novo mais tarde." };
    const [company] = await db.select({ id: companies.id, name: companies.name, archived: companies.archived }).from(companies).where(eq(companies.id, companyId.data));
    if (!company) return gone;
    const [linked] = await db.select({ companyId: mailDomains.companyId }).from(mailDomains).where(eq(mailDomains.domain, domain));
    if (linked?.companyId === company.id) return { success: `${domain} já é da empresa.`, href: `/email?dominio=${encodeURIComponent(domain)}` };
    if (linked) return { error: `O domínio ${domain} já está no servidor de e-mail da Anuntech em outra conta. Fale com a equipe.` };
    const [[{ pending }], product] = await Promise.all([
      db.select({ pending: count() }).from(mailDomainClaims).where(eq(mailDomainClaims.companyId, company.id)),
      mailProduct(company.id),
    ]);
    const refusal = domainAddRefusal({ role, archived: company.archived, product: product.state, pending });
    if (refusal) return { error: refusal };
    const created = await db.transaction(async (tx) => {
      const [claim] = await tx
        .insert(mailDomainClaims)
        .values({ companyId: company.id, domain, token: ownershipToken(), actorId: actor.user.id })
        .onConflictDoNothing()
        .returning({ id: mailDomainClaims.id });
      // Already waiting (another tab): its page, with the same token.
      if (!claim) return false;
      await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: company.id, action: "email.domain.claimed", entityId: claim.id, details: { domain } });
      return true;
    });
    return { success: created ? `${domain} adicionado. Falta provar que ele é da empresa.` : `${domain} já está esperando a confirmação.`, href: page };
  } catch (error) {
    return failure(error);
  }
}

/** "Conferir agora": looks for the TXT record; found, the domain goes to the server and the mailboxes can be created. */
export async function verifyMailDomain(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (actor.assisting) return blocked;
  const id = uuid.safeParse(field(form, "id"));
  if (!id.success) return claimGone;
  try {
    const claim = await claimById(actor, id.data);
    if (!claim) return claimGone;
    if (!(await reserveHourly("mail-setup", actor.user.id, SETUP_HOURLY))) return { error: "Muitas conferências nesta hora. Tente de novo mais tarde." };
    await db.update(mailDomainClaims).set({ checkedAt: new Date() }).where(eq(mailDomainClaims.id, claim.id));
    const check = await claimCheck(claim);
    if (check.status === "unknown") return { error: "A consulta ao DNS não respondeu agora. Tente de novo em alguns minutos." };
    if (check.status === "missing")
      return {
        error: `Ainda não encontramos o TXT ${check.record?.name} com o valor certo. Se acabou de criar, espere alguns minutos: o DNS leva um tempo para mostrar a mudança.`,
      };
    const { created } = await establishDomain(actor, claim);
    return {
      success: `${claim.domain} confirmado${created ? " e criado no servidor de e-mail" : ""}. Já dá para criar as caixas; o resto do DNS está logo abaixo.`,
    };
  } catch (error) {
    return failure(error, "O servidor de e-mail não confirmou a criação do domínio. Espere um minuto e confira de novo.");
  }
}

/** Takes a domain out of the waiting list; nothing was on the server for it. */
export async function removeMailDomainClaim(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (actor.assisting) return blocked;
  const id = uuid.safeParse(field(form, "id"));
  if (!id.success) return claimGone;
  try {
    const claim = await claimById(actor, id.data);
    if (!claim) return claimGone;
    const removed = await db.transaction(async (tx) => {
      const [row] = await tx.delete(mailDomainClaims).where(eq(mailDomainClaims.id, claim.id)).returning({ id: mailDomainClaims.id });
      if (!row) return false;
      await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: claim.companyId, action: "email.domain.claim_removed", entityId: claim.id, details: { domain: claim.domain } });
      return true;
    });
    if (!removed) return claimGone;
    return { success: `${claim.domain} removido da lista.`, href: `/email?empresa=${claim.companyId}` };
  } catch (error) {
    return failure(error);
  }
}

/** "Conferir de novo" on the DNS guide: asks the DNS now instead of the copy of the last few minutes. */
export async function recheckMailDns(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (actor.assisting) return blocked;
  const domain = normalizeMailDomain(field(form, "domain"));
  if (!domain) return { error: "Esse domínio não é gerenciado pelo Console." };
  try {
    const owner = await domainOwner(domain);
    if (!owner || !canManageMail(actor, owner.companyId)) return { error: `O domínio ${domain} não é gerenciado pelo Console.` };
    if (!(await reserveHourly("mail-setup", actor.user.id, SETUP_HOURLY))) return { error: "Muitas conferências nesta hora. Tente de novo mais tarde." };
    const { checks } = await dnsHealth(domain, { fresh: true });
    const missing = checks.filter((check) => check.status === "missing").length;
    return { success: missing ? `Conferido agora: ${missing === 1 ? "falta 1 item" : `faltam ${missing} itens`}.` : "Conferido agora: tudo certo." };
  } catch (error) {
    return failure(error);
  }
}
