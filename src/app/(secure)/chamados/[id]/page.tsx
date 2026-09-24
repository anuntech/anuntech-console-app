import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  attachments,
  companies,
  engagements,
  messages,
  tickets,
  user,
} from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { hasConsoleStaffAccess } from "@/lib/console-members";
import {
  TicketDetail,
  type TicketEntry,
} from "@/components/chamados/ticket-detail";
export const metadata: Metadata = {
  title: "Chamado",
  description:
    "Acompanhe a conversa, a situação e os arquivos de uma solicitação de atendimento.",
};

export default async function Ticket({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  const { id } = await params;
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
  return (
    <TicketDetail
      data={{
        ticket: {
          id: t.id,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          assignedTo: t.assignedTo,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          companyId: t.companyId,
          company: row.company,
          engagement: row.engagement,
          author: { name: row.authorName, email: row.authorEmail },
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
        now: new Date().toISOString(),
      }}
    />
  );
}
