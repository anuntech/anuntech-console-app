import "server-only";
import { updateNoticePreferences } from "../../companies/company-settings";
import { markCompanyStep } from "../../guide/mark-step";
import { logDatabaseFault } from "../../action-errors";
import { companyNoticeTopics } from "../../notifications/notice-topics";
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
};
