import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { auditEvents, catalogItems, companies, engagementSuspensions, engagements, mailDomainClaims, mailDomains } from "@/db/schema";
import type { Actor } from "../access/access";
import { databaseFault } from "../action-errors";
import { db } from "../db";
import { companyDebt } from "../suspensions/suspensions";
import { MailRefusal, createServerDomain, ownershipAnswer } from "./mail-admin";
import { canManageMail, mailRole, ownershipCheck, type MailProductState } from "./mail-rules";

/*
 * The client's own way into the e-mail (docs/plano-email.md, Fases 3 and 4,
 * as Kauan set them on 01/11/2026): the Administrador contracts the e-mail
 * product in Produtos, adds the company's domain, proves it with a TXT
 * record and publishes the rest of the DNS at their own provider. Nobody at
 * Anuntech touches the DNS or the server for it. Contracting creates the
 * product only: the team bills it as today (docs/rules.md, rule 1).
 */

/** The e-mail items a company can contract: active products of the catalog blocked as "Servidor de e-mail". */
export async function mailOffers() {
  return db
    .select({ id: catalogItems.id, name: catalogItems.name, description: catalogItems.description, amountCents: catalogItems.defaultAmountCents, interval: catalogItems.interval })
    .from(catalogItems)
    .where(and(eq(catalogItems.active, true), eq(catalogItems.kind, "product"), eq(catalogItems.suspensionKind, "email")))
    .orderBy(asc(catalogItems.name));
}

/** The company's e-mail product, if any: the live one first (a completed one does not count). */
export async function mailProduct(companyId: string, executor: Pick<typeof db, "select"> = db) {
  const rows = await executor
    .select({ id: engagements.id, status: engagements.status })
    .from(engagements)
    .innerJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
    .where(and(eq(engagements.companyId, companyId), eq(engagements.kind, "product"), eq(catalogItems.suspensionKind, "email"), inArray(engagements.status, ["active", "paused", "suspended"])))
    .orderBy(desc(engagements.createdAt));
  const live = rows.find((row) => row.status === "active") ?? rows[0];
  return { id: live?.id ?? null, state: (live?.status ?? "none") as MailProductState };
}

/** Each of the companies' e-mail state, for Produtos ("Contratar e-mail" only where there is none yet). */
export async function mailProductStates(companyIds: string[]) {
  const states = new Map<string, MailProductState>(companyIds.map((id) => [id, "none"]));
  if (!companyIds.length) return states;
  const rows = await db
    .select({ companyId: engagements.companyId, status: engagements.status })
    .from(engagements)
    .innerJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
    .where(and(inArray(engagements.companyId, companyIds), eq(engagements.kind, "product"), eq(catalogItems.suspensionKind, "email"), inArray(engagements.status, ["active", "paused", "suspended"])));
  for (const row of rows) if (states.get(row.companyId) !== "active") states.set(row.companyId, row.status as MailProductState);
  return states;
}

/**
 * "Contratar e-mail" in Produtos: the companies the person is Administrador
 * of that have no e-mail product yet, and the catalog's plans. Nothing for
 * the team (it links products itself) or for assisted access.
 */
export async function mailOfferFor(actor: Actor) {
  const companies = actor.grants
    .filter((grant) => mailRole(actor, grant.company.id) === "manager" && !grant.company.archived)
    .map((grant) => ({ id: grant.company.id, name: grant.company.name }));
  if (!companies.length) return null;
  const states = await mailProductStates(companies.map((company) => company.id));
  const open = companies.filter((company) => states.get(company.id) === "none");
  if (!open.length) return null;
  const offers = await mailOffers();
  return offers.length ? { companies: open, offers } : null;
}

/** Whether the company is in good standing for a new product: overdue invoices and open suspensions. */
export async function companyStanding(companyId: string) {
  const [debt, open] = await Promise.all([
    companyDebt(companyId),
    db
      .select({ id: engagementSuspensions.id })
      .from(engagementSuspensions)
      .innerJoin(engagements, eq(engagements.id, engagementSuspensions.engagementId))
      .where(and(eq(engagements.companyId, companyId), isNull(engagementSuspensions.liftedAt)))
      .limit(1),
  ]);
  return { overdue: debt.invoices.length, suspended: open.length > 0 };
}

export type DomainClaim = { id: string; companyId: string; companyName: string; domain: string; token: string; createdAt: Date; checkedAt: Date | null };

const claimColumns = {
  id: mailDomainClaims.id,
  companyId: mailDomainClaims.companyId,
  companyName: companies.name,
  domain: mailDomainClaims.domain,
  token: mailDomainClaims.token,
  createdAt: mailDomainClaims.createdAt,
  checkedAt: mailDomainClaims.checkedAt,
};

/** The company's domains waiting for the proof, oldest first. */
export async function pendingDomains(companyId: string): Promise<DomainClaim[]> {
  return db
    .select(claimColumns)
    .from(mailDomainClaims)
    .innerJoin(companies, eq(companies.id, mailDomainClaims.companyId))
    .where(eq(mailDomainClaims.companyId, companyId))
    .orderBy(asc(mailDomainClaims.createdAt));
}

/**
 * The claim on a domain that the person manages: their company's (the
 * company asked for first, for the team, which may see several). Null when
 * there is none for them, the same as one that does not exist.
 */
export async function claimFor(actor: Actor, domain: string, companyId?: unknown): Promise<DomainClaim | null> {
  if (actor.assisting) return null;
  const rows = await db
    .select(claimColumns)
    .from(mailDomainClaims)
    .innerJoin(companies, eq(companies.id, mailDomainClaims.companyId))
    .where(eq(mailDomainClaims.domain, domain))
    .orderBy(desc(mailDomainClaims.createdAt));
  const mine = rows.filter((row) => canManageMail(actor, row.companyId));
  return mine.find((row) => row.companyId === companyId) ?? mine[0] ?? null;
}

/** A claim by id, when the person manages its company. */
export async function claimById(actor: Actor, id: string): Promise<DomainClaim | null> {
  if (actor.assisting) return null;
  const [row] = await db.select(claimColumns).from(mailDomainClaims).innerJoin(companies, eq(companies.id, mailDomainClaims.companyId)).where(eq(mailDomainClaims.id, id));
  return row && canManageMail(actor, row.companyId) ? row : null;
}

/** The ownership check of a claim, as the guide shows it. */
export async function claimCheck(claim: DomainClaim) {
  return ownershipCheck(claim.domain, claim.token, await ownershipAnswer(claim.domain));
}

const DOMAIN_LINKED = "console_mail_domains_domain_unique";
const elsewhere = (domain: string) =>
  new MailRefusal(`O domínio ${domain} já está no servidor de e-mail da Anuntech em outra conta. Fale com a equipe.`);

/**
 * The proof was found: the domain goes to the server (created there, or the
 * one the team already prepared, as for a client coming from cPanel) and is
 * linked to the company, and the claim is gone. A domain another company got
 * first stays theirs. The server comes before the database: if the link
 * fails, the next check finds the domain there and only links it.
 */
export async function establishDomain(actor: Actor, claim: DomainClaim) {
  const [linked] = await db.select({ companyId: mailDomains.companyId }).from(mailDomains).where(eq(mailDomains.domain, claim.domain));
  if (linked && linked.companyId !== claim.companyId) throw elsewhere(claim.domain);
  const server = linked ? { created: false } : await createServerDomain(claim.domain);
  try {
    await db.transaction(async (tx) => {
      if (!linked) {
        const [link] = await tx.insert(mailDomains).values({ companyId: claim.companyId, domain: claim.domain, actorId: actor.user.id }).returning({ id: mailDomains.id });
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: claim.companyId,
          action: "email.domain.verified",
          entityId: link.id,
          details: { domain: claim.domain, company: claim.companyName, createdOnServer: server.created },
        });
      }
      await tx.delete(mailDomainClaims).where(and(eq(mailDomainClaims.companyId, claim.companyId), eq(mailDomainClaims.domain, claim.domain)));
    });
  } catch (error) {
    const fault = databaseFault(error);
    if (fault?.code === "23505" && fault.constraint === DOMAIN_LINKED) throw elsewhere(claim.domain);
    throw error;
  }
  return server;
}
