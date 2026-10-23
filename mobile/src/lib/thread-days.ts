/* The day separators of a conversation, as the web's ticket thread draws
   them: "Hoje", "Ontem", "20 de outubro" (and the year when it is not this
   one), always on the Console's clock (America/Sao_Paulo). */

const TIME_ZONE = "America/Sao_Paulo";
const DAY = 86400000;

const numeric = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const long = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "numeric", month: "long" });
const longYear = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });

/** The civil day of an instant in São Paulo, as YYYY-MM-DD. */
export function dayKey(at: string | Date) {
  const [d, m, y] = numeric.format(new Date(at)).split("/");
  return `${y}-${m}-${d}`;
}

/** "Hoje", "Ontem", "20 de outubro" or "20 de outubro de 2025". */
export function dayLabel(at: string, now: Date = new Date()) {
  const key = dayKey(at);
  if (key === dayKey(now)) return "Hoje";
  if (key === dayKey(new Date(now.getTime() - DAY))) return "Ontem";
  return (key.slice(0, 4) === dayKey(now).slice(0, 4) ? long : longYear).format(new Date(at));
}
