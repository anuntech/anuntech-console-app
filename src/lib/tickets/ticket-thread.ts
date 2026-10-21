import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { attachments, companies, engagements, messages, tickets, user } from "@/db/schema";
import { canSeeTicket, type Actor } from "../access/access";
import { teamMemberName } from "../account/account-identity";
import { hasConsoleStaffAccess } from "../access/console-members";

/**
 * A ticket as its viewer may see it, or null when it does not exist or is
 * out of reach (both answer "not found"): the ticket, the conversation and
 * the files, in order. Used by /chamados/[id] and the app's tickets.get.
 * A client never gets the assignee's or a team author's e-mail.
 */
export async function loadTicketThread(actor: Actor, id: string) {
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
  if (!row || !canSeeTicket(actor, row.ticket)) return null;
  const [thread, files] = await Promise.all([
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
  const fileOut = (f: (typeof files)[number]) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    mime: f.mime,
    createdAt: f.createdAt.toISOString(),
    author: f.author,
  });
  // A reply and its attachments share an instant; the words come first.
  const entries = [
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
      entry: { kind: "file" as const, file: fileOut(f), staff: staff.get(f.email) ?? false },
    })),
  ]
    .sort((a, b) => a.at - b.at || a.order - b.order)
    .map((item) => item.entry);
  // A client never sees a team member's e-mail.
  const authorIsTeam = !actor.admin && (await hasConsoleStaffAccess(row.authorEmail));
  const t = row.ticket;
  return {
    /** The full row, for the web page's team-only extras; never send it as is. */
    row: t,
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
    entries,
    files: files.map(fileOut),
  };
}
