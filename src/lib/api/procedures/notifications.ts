import "server-only";
import { updateNoticePreferences } from "../../companies/company-settings";
import { markCompanyStep } from "../../guide/mark-step";
import { logDatabaseFault } from "../../action-errors";
import { companyNoticeTopics } from "../../notifications/notice-topics";
import { noticeHistory } from "../../notifications/notice-history";
import { noticeActionLabel, noticeRecipient, noticeStatusLabel, noticeTone } from "../../notifications/notice-history-view";
import { api } from "../server";
import { guard } from "../access";
import { answer, managedCompany } from "../managed-company";

/** Configurações → Notificações: who receives the managed company's notices. */
export const notifications = {
  get: api.notifications.get.use(guard({ self: true })).handler(async ({ context }) => {
    const companyId = managedCompany(context.actor);
    const topics = await companyNoticeTopics(companyId);
    // Opening the screen counts as the first step, as the web page does.
    await markCompanyStep(context.actor, companyId, "notices_reviewed").catch((error) => logDatabaseFault("first steps", error));
    return { topics };
  }),
  save: api.notifications.save.use(guard({ self: true })).handler(async ({ input, context }) => {
    const companyId = managedCompany(context.actor);
    return answer(await updateNoticePreferences(context.actor, { companyId, ...input }));
  }),
  /** Histórico de envios, the same rows and pages as the web's (notice-history.ts). */
  history: api.notifications.history.use(guard({ self: true })).handler(async ({ input, context }) => {
    const companyId = managedCompany(context.actor);
    const { rows, total, page, pageCount } = await noticeHistory(companyId, input.page);
    return {
      rows: rows.map((row) => {
        const [, area, recordId] = row.href.split("/");
        return {
          id: row.id,
          subject: row.subject,
          actionLabel: noticeActionLabel(row.action),
          kind: area === "financeiro" ? ("invoice" as const) : ("ticket" as const),
          recordId,
          channel: row.channel === "email" ? ("email" as const) : ("whatsapp" as const),
          recipient: noticeRecipient(row.channel, row.destination),
          status: row.status,
          statusLabel: noticeStatusLabel(row.status),
          tone: noticeTone(row.status),
          error: row.error,
          createdAt: new Date(row.created_at).toISOString(),
        };
      }),
      total,
      page,
      pageCount,
      showCompany: false,
    };
  }),
};
