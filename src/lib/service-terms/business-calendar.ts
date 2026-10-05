/*
 * Business time as the contracts count it: Dias Úteis (no Saturday, Sunday,
 * national holiday or holiday of the city of Anuntech's seat), from 9h to
 * 18h in Brasília. São Paulo has kept UTC−3 all year since daylight saving
 * ended in 2019, so local time is a fixed offset here. Pure: the local
 * holidays come in as data (Configurações → Dados da empresa).
 */

/** Holidays of the seat beyond the national ones. Carnaval and Corpus Christi are not national holidays. */
export type LocalHolidays = {
  city?: string;
  /** Fixed dates every year, as MM-DD. */
  dates?: { date: string; name: string }[];
  corpusChristi?: boolean;
  carnival?: boolean;
};

const OFFSET_MS = 3 * 60 * 60 * 1000;
export const DAY_START = 9 * 60;
export const DAY_END = 18 * 60;

const NATIONAL: [string, string][] = [
  ["01-01", "Confraternização Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência do Brasil"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclamação da República"],
  ["11-20", "Dia Nacional de Zumbi e da Consciência Negra"],
  ["12-25", "Natal"],
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Easter Sunday (Gregorian), as a UTC date. */
export function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const shift = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

/** Every holiday of a year, by YYYY-MM-DD. */
export function holidaysOf(year: number, local: LocalHolidays = {}) {
  const days = new Map<string, string>();
  for (const [date, name] of NATIONAL) days.set(`${year}-${date}`, name);
  const sunday = easter(year);
  days.set(ymd(shift(sunday, -2)), "Sexta-feira Santa");
  if (local.carnival) {
    days.set(ymd(shift(sunday, -48)), "Carnaval");
    days.set(ymd(shift(sunday, -47)), "Carnaval");
  }
  if (local.corpusChristi) days.set(ymd(shift(sunday, 60)), "Corpus Christi");
  for (const { date, name } of local.dates ?? [])
    if (/^\d{2}-\d{2}$/.test(date)) days.set(`${year}-${date}`, name);
  return days;
}

export type Calendar = { isBusinessDay: (date: string) => boolean; holiday: (date: string) => string | null };

export function calendar(local: LocalHolidays = {}): Calendar {
  const years = new Map<number, Map<string, string>>();
  const holiday = (date: string) => {
    const year = Number(date.slice(0, 4));
    if (!years.has(year)) years.set(year, holidaysOf(year, local));
    return years.get(year)!.get(date) ?? null;
  };
  return {
    holiday,
    isBusinessDay: (date) => {
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      return weekday !== 0 && weekday !== 6 && !holiday(date);
    },
  };
}

/** Local (Brasília) day and minute of the day for an instant. */
function local(at: Date) {
  const l = new Date(at.getTime() - OFFSET_MS);
  return { day: ymd(l), minute: l.getUTCHours() * 60 + l.getUTCMinutes() + l.getUTCSeconds() / 60 };
}
/** The instant for a local day at a minute of that day. */
function instant(day: string, minute: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + minute * 60000 + OFFSET_MS);
}
const nextDay = (day: string) => ymd(shift(new Date(`${day}T00:00:00Z`), 1));

/** Business minutes from `from` to `to` (0 when `to` is not later). */
export function businessMinutesBetween(from: Date, to: Date, cal: Calendar) {
  if (to <= from) return 0;
  let total = 0;
  let { day, minute } = local(from);
  const end = local(to);
  for (let guard = 0; guard < 3700 && day <= end.day; guard++) {
    if (cal.isBusinessDay(day)) {
      const start = Math.max(minute, DAY_START);
      const stop = Math.min(day === end.day ? end.minute : DAY_END, DAY_END);
      if (stop > start) total += stop - start;
    }
    day = nextDay(day);
    minute = 0;
  }
  return Math.round(total);
}

/** The instant `minutes` business minutes after `from`. */
export function addBusinessMinutes(from: Date, minutes: number, cal: Calendar) {
  let { day, minute } = local(from);
  let left = Math.max(0, minutes);
  for (let guard = 0; guard < 3700; guard++) {
    if (cal.isBusinessDay(day) && minute < DAY_END) {
      const start = Math.max(minute, DAY_START);
      const room = DAY_END - start;
      if (left <= room) return instant(day, start + left);
      left -= room;
    }
    day = nextDay(day);
    minute = 0;
  }
  throw new Error("Prazo fora do calendário.");
}

/** When the clock starts for something that arrives at `at`: now, or the next opening. */
export function nextBusinessStart(at: Date, cal: Calendar) {
  return addBusinessMinutes(at, 0, cal);
}

/** Whether `at` falls inside business hours. */
export function inBusinessHours(at: Date, cal: Calendar) {
  const { day, minute } = local(at);
  return cal.isBusinessDay(day) && minute >= DAY_START && minute < DAY_END;
}
