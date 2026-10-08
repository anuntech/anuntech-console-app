import type { Metadata } from "next";
import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  accountEmails,
  attachments,
  companies,
  consoleStaffMembers,
  engagements,
  messages,
  tickets,
  user,
} from "@/db/schema";
import { getActor, canAccess } from "@/lib/access/access";
import { resolveAccountIdentity, teamMemberName } from "@/lib/account/account-identity";
import { hasConsoleStaffAccess } from "@/lib/access/console-members";
import { normalizeEmail } from "@/lib/access/permissions";
import {
  TicketDetail,
  type TicketAssignee,
  type TicketClock,
  type TicketEntry,
} from "@/components/chamados/ticket-detail";
import { loadCalendar } from "@/lib/service-terms/terms";
import { businessMinutesBetween } from "@/lib/service-terms/business-calendar";
import { businessSpanLabel, visibleToClient } from "@/lib/service-terms/ticket-clock";
import { commitmentLine } from "@/lib/service-terms/terms-text";
import { bankTerms } from "@/lib/service-terms/hours-bank";
import { saoPauloDate } from "@/lib/dates";
import type { TicketHoursData } from "@/components/chamados/ticket-hours";
import { timeEntries } from "@/db/schema";
import { desc } from "drizzle-orm";
export const metadata: Metadata = {
  title: "Chamado",
  description:
    "A conversa, a situação e os anexos de um chamado.",
};

/**
 * Who can take a ticket: the owner and active Console staff with an account.
 * Same staff lookup as `projectPeople` in lib/tasks, without the company's
 * members, since only the Anuntech team answers tickets. The value is the
 * account's normalized e-mail because `updateTicket` stores an e-mail.
 */
async function ticketAssignees(): Promise<TicketAssignee[]> {
  const columns = { id: user.id, name: user.name, email: user.email };
  const staffColumns = { ...columns, staffEmail: consoleStaffMembers.email };
  const owner = process.env.CONSOLE_ADMIN_EMAIL?.trim();
  const [staff, ownerId] = await Promise.all([
    db
      .select(staffColumns)
      .from(consoleStaffMembers)
      .leftJoin(
        accountEmails,
        and(
          eq(accountEmails.email, consoleStaffMembers.email),
          isNotNull(accountEmails.verifiedAt),
        ),
      )
      .innerJoin(
        user,
        or(
          eq(user.email, consoleStaffMembers.email),
          eq(user.id, accountEmails.userId),
        ),
      )
      .where(eq(consoleStaffMembers.active, true)),
    owner
      ? resolveAccountIdentity(normalizeEmail(owner)).then((i) => i.userId)
      : null,
  ]);
  // One option per person, keyed by account; staff rows reached through an
  // alias e-mail add that alias so tickets assigned to it still match.
  const people = new Map<string, { name: string; email: string; aliases: Set<string> }>();
  for (const row of staff) {
    const person = people.get(row.id) ?? { name: row.name, email: normalizeEmail(row.email), aliases: new Set<string>() };
    const alias = normalizeEmail(row.staffEmail);
    if (alias !== person.email) person.aliases.add(alias);
    people.set(row.id, person);
  }
  if (ownerId && !people.has(ownerId)) {
    const [row] = await db.select(columns).from(user).where(eq(user.id, ownerId));
    if (row) people.set(row.id, { name: row.name, email: normalizeEmail(row.email), aliases: new Set() });
  }
  return [...people.values()]
    .map((p) => ({ name: p.name, email: p.email, ...(p.aliases.size ? { aliases: [...p.aliases] } : {}) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export default async function Ticket({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resposta?: string }>;
}) {
  const actor = await getActor();
  const { id } = await params;
  // A reply the team prepared elsewhere (a proposal sent or answered); it is only a draft in the box.
  const { resposta } = await searchParams;
  const [row] = await db
    .select({
      ticket: tickets,
      company: companies.name,
      engagement: engagements.name,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(tickets)
    .innerJoin(companies, eq(companies.id, tickets.companyId))
    .innerJoin(user, eq(user.id, tickets.authorId))
    .leftJoin(engagements, eq(engagements.id, tickets.engagementId))
    .where(eq(tickets.id, id));
  if (!row || !canAccess(actor, row.ticket.companyId, "support")) notFound();
  const [thread, files, assignees] = await Promise.all([
    db
      .select({
        id: messages.id,
        body: messages.body,
        createdAt: messages.createdAt,
        author: user.name,
        authorId: user.id,
        authorImage: user.image,
        email: user.email,
      })
      .from(messages)
      .innerJoin(user, eq(user.id, messages.authorId))
      .where(eq(messages.ticketId, id))
      .orderBy(asc(messages.createdAt)),
    db
      .select({
        id: attachments.id,
        name: attachments.name,
        size: attachments.size,
        mime: attachments.mime,
        createdAt: attachments.createdAt,
        author: user.name,
        email: user.email,
      })
      .from(attachments)
      .innerJoin(user, eq(user.id, attachments.authorId))
      .where(eq(attachments.ticketId, id))
      .orderBy(asc(attachments.createdAt)),
    actor.admin ? ticketAssignees() : undefined,
  ]);
  // Clients see who took the ticket by name, never by e-mail.
  const assigneeName = actor.admin ? null : await teamMemberName(row.ticket.assignedTo);
  // Who speaks for Anuntech in the thread.
  const staff = new Map(
    await Promise.all(
      [...new Set([...thread, ...files].map((e) => e.email))].map(
        async (email) => [email, await hasConsoleStaffAccess(email)] as const,
      ),
    ),
  );
  // A reply and its attachments share an instant; the words come first.
  const timeline: { at: number; order: number; entry: TicketEntry }[] = [
    ...thread.map((m) => ({
      at: m.createdAt.getTime(),
      order: 0,
      entry: {
        kind: "message" as const,
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        author: m.author,
        authorId: m.authorId,
        authorImage: m.authorImage,
        staff: staff.get(m.email) ?? false,
      },
    })),
    ...files.map((f) => ({
      at: f.createdAt.getTime(),
      order: 1,
      entry: {
        kind: "file" as const,
        file: {
          id: f.id,
          name: f.name,
          size: f.size,
          mime: f.mime,
          createdAt: f.createdAt.toISOString(),
          author: f.author,
        },
        staff: staff.get(f.email) ?? false,
      },
    })),
  ].sort((a, b) => a.at - b.at || a.order - b.order);
  const t = row.ticket;
  const now = new Date();
  // The deadlines a viewer may see: the team always, the client once the conditions are published.
  let clock: TicketClock | null = null;
  if (t.terms && (t.responseDueAt || t.resolutionDueAt) && (actor.admin || visibleToClient(t.terms, now))) {
    const cal = await loadCalendar();
    clock = {
      label: t.terms.label,
      responseDueAt: t.responseDueAt?.toISOString() ?? null,
      resolutionDueAt: t.resolutionDueAt?.toISOString() ?? null,
      firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
      respondedIn: t.firstResponseAt
        ? businessSpanLabel(Math.max(1, businessMinutesBetween(t.createdAt, t.firstResponseAt, cal)))
        : null,
      pausedSince: t.status === "waiting_customer" && t.terms.policy.pausesWhileWaiting ? t.waitingSince?.toISOString() ?? null : null,
      commitment: commitmentLine(t.terms),
      clientFrom: actor.admin && !visibleToClient(t.terms, now) ? t.terms.publishAt : null,
    };
  }
  // Hours bank and improvement estimate, where the company's conditions have them (SUP 3 and 4).
  const bank = await bankTerms(t.companyId, { client: !actor.admin, now });
  const improvementLimit = t.terms?.policy.improvementBankLimitMinutes ?? bank?.policy.improvementBankLimitMinutes ?? null;
  const hours: TicketHoursData | null =
    bank || improvementLimit || t.estimateStatus
      ? {
          companyId: t.companyId,
          bank: !!bank,
          entries: actor.admin
            ? (
                await db
                  .select({ id: timeEntries.id, minutes: timeEntries.minutes, note: timeEntries.note, workedOn: timeEntries.workedOn, kind: timeEntries.kind })
                  .from(timeEntries)
                  .where(eq(timeEntries.ticketId, t.id))
                  .orderBy(desc(timeEntries.workedOn))
              )
            : [],
          estimate: { minutes: t.estimateMinutes, status: t.estimateStatus },
          improvementLimitMinutes: improvementLimit,
          canApprove: !actor.admin && canAccess(actor, t.companyId, "finance"),
          today: saoPauloDate(now),
        }
      : null;
  // A client never sees a team member's e-mail.
  const authorIsTeam = !actor.admin && (await hasConsoleStaffAccess(row.authorEmail));
  return (
    <TicketDetail
      data={{
        ticket: {
          id: t.id,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          assignedTo: actor.admin ? t.assignedTo : null,
          assigneeName,
          kind: t.kind,
          impact: t.impact,
          channel: t.channel,
          waitingFor: t.status === "waiting_customer" ? t.waitingFor : null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          companyId: t.companyId,
          company: row.company,
          engagement: row.engagement,
          author: { name: row.authorName, email: authorIsTeam ? "Equipe Anuntech" : row.authorEmail },
        },
        entries: timeline.map((item) => item.entry),
        files: files.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          mime: f.mime,
          createdAt: f.createdAt.toISOString(),
          author: f.author,
        })),
        viewer: { admin: actor.admin },
        replyDraft: actor.admin && typeof resposta === "string" ? resposta.slice(0, 2000) : undefined,
        assignees,
        clock,
        hours,
        now: now.toISOString(),
      }}
    />
  );
}
