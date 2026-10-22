import "server-only";
import type { BankCard } from "../../service-terms/hours-bank";
import { approveOverageAs, contestHoursReportAs } from "../../service-terms/hours-client";
import { clientBanks } from "../../painel/client-overview";
import { companyDisplayName } from "../../companies/display-name";
import { api } from "../server";
import { guard } from "../access";
import { answer } from "../managed-company";

/** A bank card for the app: the month's numbers and the last five lines, never the terms. */
export function bankView({ bank, viewer }: { bank: BankCard; viewer: "approver" | "member" }) {
  return {
    companyId: bank.companyId,
    company: companyDisplayName(bank.companyName, bank.companyDocument),
    viewer,
    month: bank.month,
    includedMinutes: bank.includedMinutes,
    usedMinutes: bank.usedMinutes,
    overageApprovedMinutes: bank.overageApprovedMinutes,
    alertPercent: bank.alertPercent,
    entries: bank.entries.slice(0, 5).map((e) => ({
      id: e.id,
      minutes: e.minutes,
      note: e.note,
      workedOn: e.workedOn,
      kind: e.kind,
      ticket: e.ticket,
      author: e.author,
    })),
    reportSentAt: bank.reportSentAt,
    contestedAt: bank.contestedAt,
    contestUntil: bank.contestUntil,
    // The web shows last month only while its report was sent and can be contested.
    previous: bank.previous?.reportSentAt
      ? { month: bank.previous.month, reportSentAt: bank.previous.reportSentAt, contestedAt: bank.previous.contestedAt, contestUntil: bank.previous.contestUntil }
      : null,
  };
}

export const hours = {
  // clientBanks reads only the person's own grants; a Membro gets the lines of their selection.
  banks: api.hours.banks.use(guard({ self: true })).handler(async ({ context }) => ({
    banks: (await clientBanks(context.actor)).map(bankView),
  })),
  // The rules (answersForClient: Administradores, never the team) are in hours-client.ts, as on the web.
  approveOverage: api.hours.approveOverage
    .use(guard({ area: "finance", company: (input: { companyId: string }) => input.companyId }))
    .handler(async ({ input, context }) => answer(await approveOverageAs(context.actor, input))),
  contestReport: api.hours.contestReport
    .use(guard({ area: "finance", company: (input: { companyId: string }) => input.companyId }))
    .handler(async ({ input, context }) => answer(await contestHoursReportAs(context.actor, input))),
};
