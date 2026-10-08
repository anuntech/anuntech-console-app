import "server-only";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { billingNotices, companies, consoleStaffMembers, invoices, memberships, notificationPreferences, session, user } from "@/db/schema";
import { db } from "../db";
import { dateLabel } from "../format";
import type { FollowUpGroup } from "../commercial/follow-up";
import { inviteStatusLabel, stalledInvites } from "../access/invite-tracking";
import { contactProblems, type NoticeContacts } from "./contact-quality";
import { onboardingMissing } from "./onboarding";

/*
 * Clients and access, for the team: invites nobody accepted, accesses
 * nobody uses (or that outlived the client), contacts that make notices
 * fail, and new clients still being set up. Read only; every fix is a click.
 */

const IDLE_DAYS = 90;
const NEW_CLIENT_DAYS = 90;

/** The last time each e-mail signed in, from the sessions. */
const lastSignIn = sql<Date | null>`(select max(s.created_at) from ${session} s inner join ${user} u on u.id = s.user_id where u.email = ${memberships.email})`;

export async function clientsFollowUp(now = new Date()): Promise<FollowUpGroup[]> {
  const idleSince = new Date(now.getTime() - IDLE_DAYS * 86_400_000);
  const [invites, idle, archived, staff, contactRows, bounced, recent] = await Promise.all([
    stalledInvites(),
    db
      .select({ email: memberships.email, companyId: companies.id, company: companies.name, last: lastSignIn })
      .from(memberships)
      .innerJoin(companies, eq(companies.id, memberships.companyId))
      .where(
        and(
          eq(memberships.active, true),
          eq(companies.archived, false),
          sql`${lastSignIn} is not null and ${lastSignIn} < ${idleSince}`,
        ),
      )
      .orderBy(asc(companies.name)),
    db
      .select({ email: memberships.email, companyId: companies.id, company: companies.name })
      .from(memberships)
      .innerJoin(companies, eq(companies.id, memberships.companyId))
      .where(and(eq(memberships.active, true), eq(companies.archived, true)))
      .orderBy(asc(companies.name)),
    db
      .select({
        email: consoleStaffMembers.email,
        // Spelled out: in a one-table select Drizzle writes the column without its table, and inside the subquery it would mean u.email.
        last: sql<Date | null>`(select max(s.created_at) from ${session} s inner join ${user} u on u.id = s.user_id where u.email = console_staff_members.email)`,
      })
      .from(consoleStaffMembers)
      .where(eq(consoleStaffMembers.active, true)),
    db
      .select({
        id: companies.id,
        name: companies.name,
        document: companies.document,
        billingEmail: companies.billingEmail,
        topic: notificationPreferences.topic,
        emails: notificationPreferences.emails,
        phones: notificationPreferences.phones,
        email: notificationPreferences.email,
        phone: notificationPreferences.phone,
        emailEnabled: notificationPreferences.emailEnabled,
        whatsappEnabled: notificationPreferences.whatsappEnabled,
      })
      .from(companies)
      .leftJoin(notificationPreferences, eq(notificationPreferences.companyId, companies.id))
      .where(eq(companies.archived, false)),
    // Billing e-mails that did not arrive in the last 30 days, per company.
    db
      .selectDistinct({ companyId: invoices.companyId })
      .from(billingNotices)
      .innerJoin(invoices, eq(invoices.id, billingNotices.invoiceId))
      .where(and(eq(billingNotices.channel, "email"), inArray(billingNotices.status, ["failed", "expired"]), gte(billingNotices.nextAttemptAt, sql`now() - interval '30 days'`))),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(and(eq(companies.archived, false), gte(companies.createdAt, new Date(now.getTime() - NEW_CLIENT_DAYS * 86_400_000))))
      .orderBy(asc(companies.createdAt)),
  ]);
  const byCompany = new Map<string, { name: string; document: string; billingEmail: string; contacts: NoticeContacts[] }>();
  for (const row of contactRows) {
    const entry = byCompany.get(row.id) ?? { name: row.name, document: row.document, billingEmail: row.billingEmail, contacts: [] };
    if (row.topic)
      entry.contacts.push({
        topic: row.topic,
        emails: row.emails ?? (row.email ? [row.email] : []),
        phones: row.phones ?? (row.phone ? [row.phone] : []),
        emailEnabled: !!row.emailEnabled,
        whatsappEnabled: !!row.whatsappEnabled,
      });
    byCompany.set(row.id, entry);
  }
  const bouncedIds = new Set(bounced.map((b) => b.companyId));
  const contacts = [...byCompany.entries()]
    .map(([id, c]) => ({ id, name: c.name, problems: [...contactProblems(c, c.contacts), ...(bouncedIds.has(id) ? ["um aviso de cobrança por e-mail não chegou nos últimos 30 dias"] : [])] }))
    .filter((c) => c.problems.length);
  const onboarding: { id: string; name: string; missing: number }[] = [];
  for (const company of recent) {
    const missing = await onboardingMissing(company.id);
    if (missing.length) onboarding.push({ ...company, missing: missing.length });
  }
  const idleStaff = staff.filter((s) => !s.last || new Date(s.last) < idleSince);
  const groups: FollowUpGroup[] = [
    {
      key: "stalled-invites",
      title: "Convites sem primeiro acesso há 3 dias ou mais",
      items: invites.map((i) => ({
        line: `${i.company} · ${i.email}${i.status ? ` · convite ${inviteStatusLabel[i.status] ?? i.status}` : ""}${i.invitedAt ? ` em ${dateLabel(i.invitedAt)}` : ""}`,
        href: `/empresas/${i.companyId}`,
      })),
    },
    {
      key: "onboarding",
      title: "Clientes novos com a implantação pendente",
      items: onboarding.map((c) => ({ line: `${c.name} · ${c.missing === 1 ? "1 passo" : `${c.missing} passos`} faltando`, href: `/empresas/${c.id}` })),
    },
    {
      key: "contacts",
      title: "Contatos para revisar",
      items: contacts.map((c) => ({ line: `${c.name} · ${c.problems.join("; ")}`, href: `/empresas/${c.id}` })),
    },
    {
      key: "idle-access",
      title: `Acessos sem entrar há ${IDLE_DAYS} dias ou mais`,
      items: idle.map((m) => ({ line: `${m.company} · ${m.email} · último acesso em ${dateLabel(new Date(m.last!))}`, href: `/empresas/${m.companyId}` })),
    },
    {
      key: "archived-access",
      title: "Acessos ativos em empresas arquivadas",
      items: archived.map((m) => ({ line: `${m.company} · ${m.email}`, href: `/empresas/${m.companyId}` })),
    },
    {
      key: "idle-staff",
      title: `Equipe sem entrar há ${IDLE_DAYS} dias ou mais`,
      items: idleStaff.map((s) => ({ line: `${s.email}${s.last ? ` · último acesso em ${dateLabel(new Date(s.last))}` : " · nunca entrou"}`, href: "/configuracoes/membros" })),
    },
  ];
  return groups.filter((group) => group.items.length);
}
