import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { companies, invoices, notificationPreferences, subscriptions, user } from "@/db/schema";
import { billingReadiness } from "../billing/billing-readiness";
import type { Actor } from "../access/access";
import { managedCompanyIds } from "../access/member-access";
import { db } from "../db";
import { preferenceKey } from "../notifications/notification-preferences";
import { GUIDE_VERSION } from "./guide-content";
import { milestoneAt, milestonesOf } from "./milestones";

export type FirstStep = { key: string; title: string; href: string; done: boolean };
/** `forced`: only the billing step is left after the card was hidden; it cannot be hidden. */
export type FirstSteps = { companyId: string; steps: FirstStep[]; forced?: boolean };

/**
 * The few things a person does once to work well with Anuntech, derived
 * from data where it can be (a saved notice preference, a verified phone)
 * and from what they did otherwise. Administradores and Membros get
 * different steps. Null when everything is done or the card was hidden.
 */
export async function firstStepsFor(actor: Actor): Promise<FirstSteps | null> {
  if (actor.admin || !actor.grants.length) return null;
  const grant = actor.grants[0];
  const companyId = grant.company.id;
  // Dados da empresa edits the one company the person manages; with two or more it does not open.
  const managed = managedCompanyIds(actor);
  const ownsBilling = grant.role === "manager" && managed.length === 1 && managed[0] === companyId;
  const [seen, [me], [notices], [company], [recurrence], [invoice]] = await Promise.all([
    milestonesOf(actor.user.id, [companyId]),
    db.select({ name: user.name, phoneVerified: user.phoneNumberVerified }).from(user).where(eq(user.id, actor.user.id)),
    db.select({ key: notificationPreferences.key }).from(notificationPreferences).where(eq(notificationPreferences.key, preferenceKey(companyId, "tickets"))),
    ownsBilling ? db.select().from(companies).where(eq(companies.id, companyId)) : Promise.resolve([]),
    // Only a client Anuntech bills needs the address.
    ownsBilling
      ? db.select({ id: subscriptions.id }).from(subscriptions).where(and(eq(subscriptions.companyId, companyId), ne(subscriptions.status, "cancelled"))).limit(1)
      : Promise.resolve([]),
    ownsBilling
      ? db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.companyId, companyId), ne(invoices.status, "cancelled"))).limit(1)
      : Promise.resolve([]),
  ]);
  // Without a full billing address Inter issues nothing: the Administrador sees this step until it is fixed, even with the card hidden.
  const billing: FirstStep | null =
    company && (recurrence || invoice) && billingReadiness(company).includes("address")
      ? { key: "billing", title: "Complete o endereço de cobrança da empresa", href: "/configuracoes/empresa", done: false }
      : null;
  // Every 6 months the Administrador reviews who has access again, even with the card hidden.
  const reviewedAt = grant.role === "manager" ? await milestoneAt(actor.user.id, "members_reviewed", companyId) : null;
  const review: FirstStep | null =
    reviewedAt && Date.now() - reviewedAt.getTime() > 180 * 86_400_000
      ? { key: "members", title: "Revise quem tem acesso: faz 6 meses desde a última revisão", href: "/configuracoes/membros", done: false }
      : null;
  const forced = [billing, review].filter((step): step is FirstStep => !!step);
  if (seen.has(`first_steps_hidden:${companyId}`)) return forced.length ? { companyId, steps: forced, forced: true } : null;
  const guide: FirstStep = {
    key: "guide",
    title: `Leia como a Anuntech trabalha com a ${grant.company.name}`,
    href: "/como-trabalhamos",
    done: seen.has(`guide_read_v${GUIDE_VERSION}:`),
  };
  const steps: FirstStep[] =
    grant.role === "manager"
      ? [
          ...(billing ? [billing] : []),
          review ?? { key: "members", title: "Revise quem tem acesso ao Console", href: "/configuracoes/membros", done: seen.has(`members_reviewed:${companyId}`) },
          { key: "notices", title: "Escolha quem recebe os avisos de chamados", href: "/configuracoes/notificacoes", done: !!notices || seen.has(`notices_reviewed:${companyId}`) },
          guide,
        ]
      : [
          { key: "profile", title: "Complete seu nome e WhatsApp", href: "/conta", done: !!me?.name?.trim() && !!me?.phoneVerified },
          guide,
        ];
  return steps.every((s) => s.done) ? null : { companyId, steps };
}
