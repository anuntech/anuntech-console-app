export const APP_TIME_ZONE = "America/Sao_Paulo";
export const APP_LOCALE = "pt-BR";

// A due date is a civil date, not a timestamp: never convert it via midnight UTC.
export function brazilDateToISO(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return "";
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : "";
}
export function isoToBrazilDate(iso: string): string {
  return iso ? iso.split("-").reverse().join("/") : "";
}
export function saoPauloDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
/** The instant a São Paulo wall-clock hour happens on a civil date, whatever the server's zone. */
export function saoPauloTime(date: string, hour: number): Date {
  const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wall = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  return new Date(guess.getTime() - (wall - guess.getTime()));
}
export const BILLING_SEND_HOUR = 8;
/** Automatic client messages wait for the morning instead of going out at midnight. */
export function billingSendTime(now: Date = new Date()): Date {
  const morning = saoPauloTime(saoPauloDate(now), BILLING_SEND_HOUR);
  return now < morning ? morning : now;
}
