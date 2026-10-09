"use server";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  attachments,
  auditEvents,
  automationEvents,
  quotes,
  journeys,
  journeySteps,
  bookmarkFolderShares,
  bookmarkFolders,
  bookmarks,
  companies,
  emailDeliveries,
  engagements,
  memberships,
  messages,
  notificationPreferences,
  taskAssignees,
  taskComments,
  tasks,
  ticketNotices,
  tickets,
  hoursMonths,
  serviceTerms,
  timeEntries,
  userMilestones,
} from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import {
  COMPANY_DELETE_REFUSAL,
  canDeleteCompany,
  canDeleteEngagement,
} from "../deletion-rules";
import { lockCompanyNotifications } from "../notifications/notification-preferences";
import { companyLinks, engagementLinks } from "../record-links";

/** A refusal whose message is safe to show; anything else gets the generic one. */
class Refusal extends Error {}

/**
 * Deletes a company for good, with everything that belongs only to it: access
 * (memberships and their e-mail deliveries), tickets (messages, attachments,
 * notices), projects/products/services (tasks, their people and attachments),
 * bookmarks and bookmark folders (with their shares) and notification
 * preferences. File content lives in the rows, so nothing is left in storage.
 * The audit history stays, detached from the company. Refused while the
 * company has any invoice, recurrence, contract or proposal, or while one of
 * those points at its work. Staff only. With `from=list` the list stays where
 * it is instead of navigating back to it.
 */
export async function deleteCompany(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Só a equipe da Anuntech pode excluir." };
  const companyId = z.string().uuid().safeParse(form.get("id"));
  if (!companyId.success) return { error: "Empresa não encontrada." };
  try {
    await db.transaction(async (tx) => {
      // A notice already being delivered to its people finishes first. Taken
      // before the row lock, in the same order as a preference change, so the
      // two never wait on each other.
      await lockCompanyNotifications(tx, companyId.data, true);
      // Locked so anything created for the company or its work meanwhile (an
      // invoice, a ticket, an access) either lands first and is counted, or
      // waits and then fails on the missing row.
      const [company] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, companyId.data))
        .for("update");
      if (!company) throw new Refusal("Empresa não encontrada. Ela pode já ter sido excluída.");
      const work = await tx
        .select({ id: engagements.id })
        .from(engagements)
        .where(eq(engagements.companyId, company.id))
        .for("update");
      const [own, pointing] = await Promise.all([
        companyLinks([company.id], tx),
        engagementLinks(work.map((row) => row.id), tx),
      ]);
      if (
        !canDeleteCompany(own.get(company.id)) ||
        work.some((row) => !canDeleteEngagement(pointing.get(row.id)))
      )
        throw new Refusal(COMPANY_DELETE_REFUSAL);

      const itsTickets = tx
        .select({ id: tickets.id })
        .from(tickets)
        .where(eq(tickets.companyId, company.id));
      const itsWork = tx
        .select({ id: engagements.id })
        .from(engagements)
        .where(eq(engagements.companyId, company.id));
      const itsTasks = tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(or(eq(tasks.companyId, company.id), inArray(tasks.engagementId, itsWork)));
      const itsMemberships = tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.companyId, company.id));
      const itsFolders = tx
        .select({ id: bookmarkFolders.id })
        .from(bookmarkFolders)
        .where(eq(bookmarkFolders.companyId, company.id));

      // Tickets: notices, files, messages, then the tickets. A ticket of another
      // company pointing at this company's work only loses the link.
      // Its hours bank and conditions go first: they point at its tickets and work.
      await tx.delete(timeEntries).where(eq(timeEntries.companyId, company.id));
      await tx.update(timeEntries).set({ ticketId: null }).where(inArray(timeEntries.ticketId, itsTickets));
      await tx.update(timeEntries).set({ engagementId: null }).where(inArray(timeEntries.engagementId, itsWork));
      await tx.delete(hoursMonths).where(eq(hoursMonths.companyId, company.id));
      await tx.delete(serviceTerms).where(eq(serviceTerms.companyId, company.id));
      await tx.delete(userMilestones).where(eq(userMilestones.companyId, company.id));
      // What the automations did for it (reminders sent, debts decided) goes with it.
      await tx.delete(automationEvents).where(eq(automationEvents.companyId, company.id));
      // Its project journeys go with it; a journey elsewhere pointing at its records only loses the link.
      const itsJourneys = tx.select({ id: journeys.id }).from(journeys).where(eq(journeys.companyId, company.id));
      await tx.delete(journeySteps).where(inArray(journeySteps.journeyId, itsJourneys));
      await tx.delete(journeys).where(eq(journeys.companyId, company.id));
      await tx.update(journeys).set({ ticketId: null }).where(inArray(journeys.ticketId, itsTickets));
      await tx.update(journeys).set({ engagementId: null }).where(inArray(journeys.engagementId, itsWork));
      await tx.update(journeys).set({ hostingEngagementId: null }).where(inArray(journeys.hostingEngagementId, itsWork));
      // A proposal of another company asked for in one of its tickets only loses the link.
      await tx.update(quotes).set({ ticketId: null }).where(inArray(quotes.ticketId, itsTickets));
      const notices = await tx
        .delete(ticketNotices)
        .where(inArray(ticketNotices.ticketId, itsTickets))
        .returning({ id: ticketNotices.id });
      const files = await tx
        .delete(attachments)
        .where(
          or(inArray(attachments.ticketId, itsTickets), inArray(attachments.taskId, itsTasks)),
        )
        .returning({ id: attachments.id });
      const removedMessages = await tx
        .delete(messages)
        .where(inArray(messages.ticketId, itsTickets))
        .returning({ id: messages.id });
      await tx
        .update(tickets)
        .set({ engagementId: null })
        .where(and(inArray(tickets.engagementId, itsWork), ne(tickets.companyId, company.id)));
      const removedTickets = await tx
        .delete(tickets)
        .where(eq(tickets.companyId, company.id))
        .returning({ id: tickets.id });

      // Work: task people and comments, tasks, then the projects/products/services.
      await tx.delete(taskAssignees).where(inArray(taskAssignees.taskId, itsTasks));
      await tx.delete(taskComments).where(inArray(taskComments.taskId, itsTasks));
      const removedTasks = await tx
        .delete(tasks)
        .where(or(eq(tasks.companyId, company.id), inArray(tasks.engagementId, itsWork)))
        .returning({ id: tasks.id });
      const removedWork = await tx
        .delete(engagements)
        .where(eq(engagements.companyId, company.id))
        .returning({ id: engagements.id });

      // Access: the e-mails sent to each membership, then the memberships.
      await tx.delete(emailDeliveries).where(inArray(emailDeliveries.membershipId, itsMemberships));
      const removedMemberships = await tx
        .delete(memberships)
        .where(eq(memberships.companyId, company.id))
        .returning({ id: memberships.id });

      // Bookmarks: the company's own; anything else filed in its folders stays, loose.
      const removedBookmarks = await tx
        .delete(bookmarks)
        .where(eq(bookmarks.companyId, company.id))
        .returning({ id: bookmarks.id });
      await tx
        .update(bookmarks)
        .set({ folderId: null })
        .where(inArray(bookmarks.folderId, itsFolders));
      await tx.delete(bookmarkFolderShares).where(inArray(bookmarkFolderShares.folderId, itsFolders));
      const removedFolders = await tx
        .delete(bookmarkFolders)
        .where(eq(bookmarkFolders.companyId, company.id))
        .returning({ id: bookmarkFolders.id });

      await tx
        .delete(notificationPreferences)
        .where(eq(notificationPreferences.companyId, company.id));
      // The history stays, no longer tied to a company that is gone.
      await tx
        .update(auditEvents)
        // The link goes, the history stays traceable: each event keeps the id and name it belonged to.
        .set({
          companyId: null,
          details: sql`coalesce(${auditEvents.details}, '{}'::jsonb) || jsonb_build_object('deletedCompanyId', ${company.id}::text, 'company', coalesce(${auditEvents.details}->>'company', ${company.name}::text))`,
        })
        .where(eq(auditEvents.companyId, company.id));
      await tx.delete(companies).where(eq(companies.id, company.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: null,
        action: "company.deleted",
        entityId: company.id,
        details: {
          name: company.name,
          company: company.name,
          document: company.document,
          deletedCompanyId: company.id,
          archived: company.archived,
          memberships: removedMemberships.length,
          tickets: removedTickets.length,
          messages: removedMessages.length,
          notices: notices.length,
          engagements: removedWork.length,
          tasks: removedTasks.length,
          files: files.length,
          bookmarks: removedBookmarks.length,
          bookmarkFolders: removedFolders.length,
        },
      });
    });
    const success = "Empresa excluída.";
    // From the company's own page, revalidating would re-render it (a 404) inside
    // this response; navigating to the list loads everything fresh.
    if (form.get("from") !== "list") return { success, href: "/empresas" };
    // The company leaves every picker, list and count in the Console.
    revalidatePath("/", "layout");
    return { success };
  } catch (e) {
    if (!(e instanceof Refusal)) console.error("[delete] company failed", e);
    return {
      error: e instanceof Refusal ? e.message : "Não foi possível excluir a empresa. Tente novamente.",
    };
  }
}
