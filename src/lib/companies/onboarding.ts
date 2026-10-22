import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { accountEmails, companies, contracts, engagements, invoices, memberships, notificationPreferences, serviceTerms, subscriptions, user } from "@/db/schema";
import { db } from "../db";
import { billingReadiness } from "../billing/billing-readiness";

/*
 * "Implantação": what a new client still needs before the relationship runs
 * on its own, computed from the data (nothing to fill in). The team sees only
 * what is missing, with the link that fixes it.
 */

/** A client is "new" this long: the card and the Painel item stop after it. */
export const NEW_CLIENT_DAYS = 90;

/** New and active: an old or archived client has nothing left to set up. */
export function isNewClient(company: { archived: boolean; createdAt: Date }, now = new Date()) {
  return !company.archived && company.createdAt.getTime() > now.getTime() - NEW_CLIENT_DAYS * 86_400_000;
}

/** `href` is where it gets fixed; without one, it happens outside the team's screens. */
export type OnboardingStep = { key: string; label: string; href?: string };

/**
 * The setup as slots, one per step of `onboardingMissing`, for progress (the Implantação card).
 * Two step keys are stages of one slot: `manager-login` (the Administrador invited, not signed in yet)
 * fills `manager`, and `contract` covers both drafted and waiting on the signature.
 */
export const ONBOARDING_SLOTS = ["billing", "manager", "billing-contacts", "engagement", "contract", "terms", "charge"] as const;

/** The slot a missing step holds. */
export const onboardingSlot = (key: string) => (key === "manager-login" ? "manager" : key);

/** What the data says about a company's setup; the Implantação card and the project journey read it. */
export async function companySetupFacts(companyId: string) {
  const [[company], managers, prefs, [item], [contract], [terms], [billed]] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, companyId)),
    db
      // Spelled out: in a one-table select Drizzle writes the column without its table, and inside the subquery it would mean u.email.
      .select({ email: memberships.email, verified: sql<boolean>`exists (select 1 from ${user} u where u.email = console_memberships.email and u.email_verified) or exists (select 1 from ${accountEmails} e where e.email = console_memberships.email and e.verified_at is not null)` })
      .from(memberships)
      .where(and(eq(memberships.companyId, companyId), eq(memberships.role, "manager"), eq(memberships.active, true))),
    db.select({ topic: notificationPreferences.topic }).from(notificationPreferences).where(eq(notificationPreferences.companyId, companyId)),
    db.select({ id: engagements.id }).from(engagements).where(eq(engagements.companyId, companyId)).limit(1),
    // Signed, or else the one waiting on a signature (a new one would duplicate it).
    db
      .select({ id: contracts.id, status: contracts.status })
      .from(contracts)
      .where(and(eq(contracts.companyId, companyId), inArray(contracts.status, ["signed", "sent", "in_review"])))
      .orderBy(sql`${contracts.status} = 'signed' desc`)
      .limit(1),
    db.select({ id: serviceTerms.id }).from(serviceTerms).where(and(eq(serviceTerms.companyId, companyId), eq(serviceTerms.active, true), isNotNull(serviceTerms.verifiedAt))).limit(1),
    db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.companyId, companyId), inArray(subscriptions.status, ["active"])))
      .limit(1)
      .then(async (rows) => (rows.length ? rows : db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.companyId, companyId), inArray(invoices.status, ["issued", "paid"]))).limit(1))),
  ]);
  if (!company) return null;
  return {
    company,
    billingReady: billingReadiness(company).length === 0,
    manager: managers.length > 0,
    managerSignedIn: managers.some((m) => m.verified),
    billingContacts: prefs.some((p) => p.topic === "billing"),
    item: item ?? null,
    contract: contract ?? null,
    terms: !!terms,
    billed: !!billed,
  };
}

export async function onboardingMissing(companyId: string): Promise<OnboardingStep[]> {
  const facts = await companySetupFacts(companyId);
  if (!facts) return [];
  const { item, contract, terms, billed } = facts;
  const page = `/empresas/${companyId}`;
  const steps: (OnboardingStep | false)[] = [
    !facts.billingReady && { key: "billing", label: "Completar o cadastro para cobrar (documento e endereço)", href: `${page}?editar=1` },
    !facts.manager && { key: "manager", label: "Convidar o Administrador do cliente", href: `${page}#pessoas` },
    facts.manager && !facts.managerSignedIn && { key: "manager-login", label: "O Administrador ainda não entrou: confira o e-mail ou reenvie o convite", href: `${page}#pessoas` },
    !facts.billingContacts && { key: "billing-contacts", label: "O cliente ainda não escolheu quem recebe os avisos de cobrança (Notificações, no Console dele)" },
    !item && { key: "engagement", label: "Vincular o produto, serviço ou projeto", href: `/produtos/novo?companyId=${companyId}` },
    !contract && { key: "contract", label: "Contrato assinado no Console", href: `/contratos/novo?companyId=${companyId}` },
    contract && contract.status !== "signed" && { key: "contract", label: "Contrato enviado, esperando a assinatura", href: `/contratos/${contract.id}` },
    !terms && { key: "terms", label: "Conferir as condições de atendimento", href: `${page}#condicoes` },
    !billed && { key: "charge", label: "Primeira cobrança ou recorrência ativa", href: `/financeiro/nova?companyId=${companyId}` },
  ];
  return steps.filter((step): step is OnboardingStep => !!step);
}
