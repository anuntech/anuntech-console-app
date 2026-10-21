const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** An instant as the web shows it in lists: "20 de out., 21:30". */
export const when = (iso: string) => dateTime.format(new Date(iso));

/** A file size in KB or MB, with a comma. */
export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** Cents as the web shows them: R$ 1.234,56. */
export const money = (cents: number) => brl.format(cents / 100);

/** A civil date (YYYY-MM-DD) as "10/01/2099", never shifted by time zone. */
export function civilDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
