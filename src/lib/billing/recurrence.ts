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

/** The first date on `day` of a month (the month's last day when shorter) that is on or after `from`. */
export function monthlyDueOnOrAfter(day: number, from: string): string {
  const [year, month] = from.split("-").map(Number);
  const inMonth = (monthIndex: number) => {
    const last = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
    return new Date(Date.UTC(year, monthIndex, Math.min(day, last), 12)).toISOString().slice(0, 10);
  };
  const here = inMonth(month - 1);
  return here >= from ? here : inMonth(month);
}

/** "2026-01-31" plus n months, on the same day or the month's last day when shorter. */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const index = month - 1 + months;
  const last = new Date(Date.UTC(year, index + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(year, index, Math.min(day, last), 12)).toISOString().slice(0, 10);
}

/**
 * The next term of a contract that ran from `startsAt` to `endsAt`: from the
 * day after the end, for as long. A term of whole months (1 Jan to 31 Dec,
 * 8 Oct to 7 Oct) renews by months, so leap years and short months never
 * leave a gap; any other length renews by days.
 */
export function nextTerm(startsAt: string | null, endsAt: string): { startsAt: string; endsAt: string } {
  const start = addDays(endsAt, 1);
  if (!startsAt) return { startsAt: start, endsAt: addDays(addMonths(start, 12), -1) };
  const [sy, sm, sd] = startsAt.split("-").map(Number);
  const [ey, em, ed] = start.split("-").map(Number);
  const months = (ey - sy) * 12 + (em - sm);
  if (months > 0 && (sd === ed || addMonths(startsAt, months) === start)) return { startsAt: start, endsAt: addDays(addMonths(start, months), -1) };
  const days = Math.round((Date.parse(`${endsAt}T12:00:00Z`) - Date.parse(`${startsAt}T12:00:00Z`)) / 86_400_000);
  return { startsAt: start, endsAt: addDays(start, Math.max(days, 27)) };
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
