export type BillingInterval = "monthly" | "yearly";

export function nextDueDate(
  current: string,
  interval: BillingInterval,
  day: number,
  month: number,
): string {
  const [year, currentMonth] = current.split("-").map(Number);
  const target = new Date(
    Date.UTC(
      year + (interval === "yearly" ? 1 : 0),
      interval === "yearly" ? month - 1 : currentMonth,
      1,
      12,
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
export function issueDate(due: string, leadDays = 5): string {
  const date = new Date(`${due}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - leadDays);
  return date.toISOString().slice(0, 10);
}

/** "2026-10-07" plus n civil days. */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * A monthly period may be issued before its issue date once the previous
 * one is paid (the owner's decision, 06/10/2026), but never more than this
 * far ahead: paying the early invoice at once must not start a chain.
 */
export const EARLY_ISSUE_HORIZON_DAYS = 45;

export type EarlyIssueState = {
  interval: BillingInterval;
  issueOnPayment: boolean;
  nextDueDate: string;
  today: string;
  /** Status of the latest invoice of the recurrence due before nextDueDate, if any. */
  previousStatus: string | null;
  /** Whether any invoice of the recurrence is still open at the bank. */
  hasOpenInvoice: boolean;
  /** Linked project or service still running (true when there is none). */
  engagementActive: boolean;
};

/** Whether the next period can be issued now, before its issue date, because the current one was paid. */
export function earlyIssueAllowed(state: EarlyIssueState): boolean {
  return (
    state.interval === "monthly" &&
    state.issueOnPayment &&
    state.nextDueDate > state.today &&
    state.nextDueDate <= addDays(state.today, EARLY_ISSUE_HORIZON_DAYS) &&
    state.previousStatus === "paid" &&
    !state.hasOpenInvoice &&
    state.engagementActive
  );
}
