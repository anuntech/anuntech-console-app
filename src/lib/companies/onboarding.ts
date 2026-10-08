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

export type OnboardingStep = { key: string; label: string; href: string };

export async function onboardingMissing(companyId: string): Promise<OnboardingStep[]> {
  const [[company], managers, prefs, [item], [contract], [terms], [billed]] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, companyId)),
    db
      // Spelled out: in a one-table select Drizzle writes the column without its table, and inside the subquery it would mean u.email.
      .select({ email: memberships.email, verified: sql<boolean>`exists (select 1 from ${user} u where u.email = console_memberships.email and u.email_verified) or exists (select 1 from ${accountEmails} e where e.email = console_memberships.email and e.verified_at is not null)` })
      .from(memberships)
      .where(and(eq(memberships.companyId, companyId), eq(memberships.role, "manager"), eq(memberships.active, true))),
    db.select({ topic: notificationPreferences.topic }).from(notificationPreferences).where(eq(notificationPreferences.companyId, companyId)),
    db.select({ id: engagements.id }).from(engagements).where(eq(engagements.companyId, companyId)).limit(1),
    db.select({ id: contracts.id }).from(contracts).where(and(eq(contracts.companyId, companyId), eq(contracts.status, "signed"))).limit(1),
    db.select({ id: serviceTerms.id }).from(serviceTerms).where(and(eq(serviceTerms.companyId, companyId), eq(serviceTerms.active, true), isNotNull(serviceTerms.verifiedAt))).limit(1),
    db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.companyId, companyId), inArray(subscriptions.status, ["active"])))
      .limit(1)
      .then(async (rows) => (rows.length ? rows : db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.companyId, companyId), inArray(invoices.status, ["issued", "paid"]))).limit(1))),
  ]);
  if (!company) return [];
  const page = `/empresas/${companyId}`;
  const steps: (OnboardingStep | false)[] = [
    billingReadiness(company).length > 0 && { key: "billing", label: "Completar o cadastro para cobrar (documento e endereço)", href: `${page}?editar=1` },
    !managers.length && { key: "manager", label: "Convidar o Administrador do cliente", href: page },
    managers.length > 0 && !managers.some((m) => m.verified) && { key: "manager-login", label: "O Administrador ainda não entrou: confira o e-mail ou reenvie o convite", href: page },
    !prefs.some((p) => p.topic === "billing") && { key: "billing-contacts", label: "O cliente ainda não escolheu quem recebe os avisos de cobrança (Notificações, no Console dele)", href: page },
    !item && { key: "engagement", label: "Vincular o produto, serviço ou projeto", href: `/produtos/novo?companyId=${companyId}` },
    !contract && { key: "contract", label: "Contrato assinado no Console", href: `/contratos/novo?companyId=${companyId}` },
    !terms && { key: "terms", label: "Conferir as condições de atendimento", href: page },
    !billed && { key: "charge", label: "Primeira cobrança ou recorrência ativa", href: `/financeiro/nova?companyId=${companyId}` },
  ];
  return steps.filter((step): step is OnboardingStep => !!step);
}
