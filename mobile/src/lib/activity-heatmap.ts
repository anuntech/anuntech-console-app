/*
 * The web's "Atividade" calendar (src/components/ui/activity-heatmap.tsx) as
 * plain data for the app: weeks as columns (Sunday first), four levels for
 * how busy a day was, month labels, and the same pt-BR words. Pure and
 * dependency-free (tests/mobile-activity-heatmap.test.ts).
 */

export type ActivityDay = { date: string; count: number };
export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

const DAY = 86_400_000;
const MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const WEEKDAYS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
export const UNIT = { one: "interação", other: "interações" };

const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** "1.234", as Intl.NumberFormat("pt-BR"). */
export const formatCount = (n: number) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const noun = (count: number) => (count === 1 ? UNIT.one : UNIT.other);

export type Heatmap = {
  /** UTC time of the first day. */
  start: number;
  /** Empty cells before the first day in its week (it starts on Sunday). */
  lead: number;
  weeks: number;
  counts: number[];
  levels: HeatmapLevel[];
  thresholds: [number, number, number];
  months: { col: number; label: string }[];
  total: number;
};

/** Days in, the grid out: the web's buildModel with weeks starting on Sunday. */
export function buildHeatmap(days: ActivityDay[]): Heatmap {
  const dates = days.map((day) => toUtc(day.date)).filter(Number.isFinite);
  const start = dates.length ? Math.min(...dates) : toUtc("2025-01-01");
  const length = dates.length ? Math.round((Math.max(...dates) - start) / DAY) + 1 : 0;
  const counts = new Array<number>(length).fill(0);
  for (const day of days) {
    const index = Math.round((toUtc(day.date) - start) / DAY);
    if (index >= 0 && index < length) counts[index] += Math.max(0, day.count);
  }
  const max = counts.reduce((a, b) => Math.max(a, b), 0);
  // Quarters of the busiest day, never below 1, 2 and 3.
  const thresholds: [number, number, number] = [
    Math.max(1, Math.ceil(max * 0.25)),
    Math.max(2, Math.ceil(max * 0.5)),
    Math.max(3, Math.ceil(max * 0.75)),
  ];
  const levels = counts.map((count): HeatmapLevel =>
    count <= 0 ? 0 : count <= thresholds[0] ? 1 : count <= thresholds[1] ? 2 : count <= thresholds[2] ? 3 : 4,
  );
  const lead = new Date(start).getUTCDay();
  const weeks = Math.ceil((lead + length) / 7);
  const months: Heatmap["months"] = [];
  for (let index = 0; index < length; index++) {
    const date = new Date(start + index * DAY);
    if (index === 0 || date.getUTCDate() === 1)
      months.push({ col: Math.floor((lead + index) / 7), label: MONTHS[date.getUTCMonth()] });
  }
  // A partial first month keeps its label only when there is room before the next one.
  if (months.length > 1 && months[1].col - months[0].col < 3) months.shift();
  return { start, lead, weeks, counts, levels, thresholds, months, total: counts.reduce((a, b) => a + b, 0) };
}

/** The day at a column and row of the grid, or null for the blanks before the first and after the last day. */
export function dayAt(map: Heatmap, col: number, row: number) {
  const index = col * 7 + row - map.lead;
  return index >= 0 && index < map.counts.length ? index : null;
}

/** "seg., 12 de out. de 2026", as the web's tooltip. */
export function dayLabel(map: Heatmap, index: number) {
  const date = new Date(map.start + index * DAY);
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

/** "3 interações" or "Nenhuma interação": the tooltip's first line. */
export const countLabel = (count: number) => (count ? `${formatCount(count)} ${noun(count)}` : `Nenhuma ${UNIT.one}`);

/** "128 interações nos últimos 12 meses": the line over the grid. */
export const summary = (total: number, period = "nos últimos 12 meses") => `${formatCount(total)} ${noun(total)} ${period}`;

/** What each level means, for the legend's spoken description: the web's words. */
export function levelRanges([a, b, c]: [number, number, number]) {
  return [
    `nenhuma ${UNIT.one}`,
    a === 1 ? `1 ${UNIT.one}` : `de 1 a ${a} ${UNIT.other}`,
    `de ${a + 1} a ${b} ${UNIT.other}`,
    `de ${b + 1} a ${c} ${UNIT.other}`,
    `${c + 1} ou mais ${UNIT.other}`,
  ];
}

/** The weekday labels down the side, every other row as on the web: "", "seg.", "", "qua.", "", "sex.", "". */
export const weekdayLabels = WEEKDAYS.map((label, row) => (row % 2 === 1 ? label : ""));

/** `amount` of `top` over `base` (both #rrggbb), as CSS color-mix does for the web's level tints. */
export function mix(top: string, base: string, amount: number) {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [parse(top), parse(base)];
  return `#${a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
}

/** The five tints: level 0 a hint of the text color on the card, then the brand at 26%, 50%, 76% and full. */
export function levelColors(accent: string, foreground: string, surface: string) {
  const empty = mix(foreground, surface, 0.065);
  return [empty, mix(accent, empty, 0.26), mix(accent, empty, 0.5), mix(accent, empty, 0.76), accent];
}
