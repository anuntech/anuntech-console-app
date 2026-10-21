import "server-only";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { db } from "../db";
import { attachments, auditEvents, engagements, messages, tickets } from "@/db/schema";
import { canSeeEngagement, type Actor } from "../access/access";
import { normalizeEmail } from "../access/permissions";
import { dueLabel, priorityLabels } from "../format";
import { DOCUMENT_ATTACHMENTS } from "./attachment-rules";
import { takeTicketUploads, type prepareTicketFiles } from "./ticket-files";
import { suggestPriority, ticketChannels, ticketImpacts, ticketKinds } from "./ticket-intake";
import { usualAssignee } from "./ticket-watch";
import { enqueueTicketNotice, scheduleTicketNotices } from "./ticket-notifications";
import { governingTerms, loadCalendar, snapshotOf } from "../service-terms/terms";
import { ticketDues, visibleToClient } from "../service-terms/ticket-clock";
import { sendOpsMail } from "../notifications/ops-alerts";
import { jevEnabled } from "../assistant/jev";
import { automationOn } from "../automations/automations";
import { triageTicket } from "./ticket-triage";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Preencha os campos obrigatórios.")
    .max(max, "O texto excede o tamanho permitido.");
/** What opening a ticket takes, from the web form or the app. */
export const ticketInput = z.object({
  companyId: z.string().uuid(),
  engagementId: z.union([z.string().uuid(), z.literal("")]).default(""),
  subject: text(160),
  body: text(10000),
  // Only the team sets it by hand; otherwise the Console suggests it from the impact.
  priority: z.enum(["critical", "high", "normal"]).optional(),
  kind: z.enum(ticketKinds).optional(),
  impact: z.enum(ticketImpacts).optional(),
  channel: z.enum(ticketChannels).default("console"),
});
type PreparedFile = Awaited<ReturnType<typeof prepareTicketFiles>>[number];

/**
 * Opens a ticket: the web's createTicket and the app's tickets.create. The
 * caller checks canAccess(actor, companyId, "support") first; a product the
 * person does not see throws, as does going over the attachment limits.
 */
export async function openTicket(
  actor: Actor,
  input: z.output<typeof ticketInput>,
  options: { files?: PreparedFile[]; uploadIds?: string[] } = {},
) {
  const files = options.files ?? [];
  const impact = input.kind === "problem" ? (input.impact ?? "other") : null;
  const now = new Date();
  const ticket = await db.transaction(async (tx) => {
    const uploaded = await takeTicketUploads(tx, actor.user.id, options.uploadIds ?? []);
    if (files.length + uploaded.length > DOCUMENT_ATTACHMENTS.max || files.reduce((n, f) => n + f.size, 0) + uploaded.reduce((n, f) => n + f.size, 0) > DOCUMENT_ATTACHMENTS.maxBytes) throw new Error("Limite de anexos excedido.");
    if (input.engagementId) {
      const [eng] = await tx
        .select()
        .from(engagements)
        .where(
          and(
            eq(engagements.id, input.engagementId),
            eq(engagements.companyId, input.companyId),
          ),
        );
      // A forged id never opens a request about a product the person does not see.
      if (!eng || !canSeeEngagement(actor, eng, "support")) throw Error();
    }
    // The conditions in force now stay with the ticket, so a later change never moves a deadline already given.
    const terms = snapshotOf(await governingTerms(input.companyId, input.engagementId || null, tx));
    // The priority is Anuntech's call (support contract 5.1): the team may set it, the Console only suggests.
    const priority = (actor.admin && input.priority) || suggestPriority(input.kind, impact, terms?.policy.levels);
    const dues = ticketDues({ createdAt: now, priority, kind: input.kind, impact, terms }, await loadCalendar(tx));
    // Every ticket starts with an owner: the team member who opens it, or whoever took this client's last one.
    const assignedTo = actor.admin ? normalizeEmail(actor.user.email) : await usualAssignee(input.companyId, input.engagementId || null, tx);
    const [row] = await tx
      .insert(tickets)
      .values({
        companyId: input.companyId,
        engagementId: input.engagementId || null,
        subject: input.subject,
        priority,
        kind: input.kind ?? null,
        impact,
        channel: actor.admin ? input.channel : "console",
        terms,
        responseDueAt: dues.responseDueAt,
        resolutionDueAt: dues.resolutionDueAt,
        authorId: actor.user.id,
        assignedTo,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await tx.insert(messages).values({
      ticketId: row.id,
      authorId: actor.user.id,
      body: input.body,
    });
    if (files.length || uploaded.length) await tx.insert(attachments).values([...files, ...uploaded].map(file => ({ ...file, ticketId: row.id, authorId: actor.user.id })));
    const [event] = await tx
      .insert(auditEvents)
      .values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "ticket.created",
        entityId: row.id,
      })
      .returning({ id: auditEvents.id });
    await enqueueTicketNotice(
      tx,
      event.id,
      row,
      actor.user.name,
      "Chamado aberto",
      { email: actor.user.email },
      row.responseDueAt && visibleToClient(terms, now)
        ? `A primeira resposta vem até ${dueLabel(row.responseDueAt, now)}.`
        : null,
    );
    return row;
  });
  // Something stopped with no way around it: the whole team hears now, not at the next read of the list.
  if (ticket.impact === "down")
    await sendOpsMail(
      `Parou tudo: ${ticket.subject}`,
      `Um chamado chegou com o impacto "Parou tudo e não dá para contornar".\n\nChamado: ${ticket.subject}\nPrioridade sugerida: ${priorityLabels[ticket.priority]}\nAbrir no Console: ${process.env.BETTER_AUTH_URL || "https://console.anuntech.com"}/chamados/${ticket.id}\n\nConsole da Anuntech`,
    ).catch(() => undefined);
  scheduleTicketNotices();
  // Jev reads the text after the answer goes out; the team may get a suggested priority.
  if (jevEnabled()) after(async () => { if (await automationOn("ticketTriage")) await triageTicket(ticket.id); });
  return ticket;
}
