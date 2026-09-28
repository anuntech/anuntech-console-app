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
