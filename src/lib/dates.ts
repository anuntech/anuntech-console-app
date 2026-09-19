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
