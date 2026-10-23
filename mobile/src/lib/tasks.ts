// The board's small readings, as the web's (../src/lib/projects/task-model.ts
// and ../src/lib/format.ts) draws them: the server sends the rest ready.
import { civilDate, when } from "./format";

/** "2h", "1h30", "45min" for an estimate in minutes (a column's sum, after filtering). */
export function estimateLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}min`;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

/** Lowercase without accents, for the board's search. */
export const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" or the date. */
export function relativeLabel(iso: string, now = new Date()) {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return when(iso);
}

/** Digits typed as a date: 01/02/2027, never a trailing separator so backspace works. */
export function formatDateInput(value: string) {
  const n = value.replace(/\D/g, "").slice(0, 8);
  if (n.length > 4) return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
  if (n.length > 2) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return n;
}

/** DD/MM/AAAA as the API's YYYY-MM-DD; "" when empty, null when it is not a real date. */
export function isoFromInput(value: string): string | null {
  if (!value.trim()) return "";
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD as the field shows it. */
export const inputFromIso = (iso: string | null) => (iso ? civilDate(iso) : "");

/*
 * A label's colour, as the web's (../src/components/projetos/project-badges.tsx):
 * the same hash of the text picks one of three tones, so the same label has the
 * same colour on the card, the filter and the task, in the app and on the web.
 * Brand and neutrals only: green, amber and red already mean a state.
 */
export type LabelTone = "brand" | "neutral" | "outline";
const LABEL_TONES: LabelTone[] = ["brand", "neutral", "outline"];

export function labelTone(label: string): LabelTone {
  let hash = 0;
  for (const char of label.toLocaleLowerCase("pt-BR")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return LABEL_TONES[hash % LABEL_TONES.length];
}

type LabelPalette = {
  accent: string;
  infoEdge: string;
  primary: string;
  secondary: string;
  secondaryForeground: string;
  border: string;
  foreground: string;
  muted: string;
};

/** The chip (background, edge, text) and the solid dot of a label, in the app's palette. */
export function labelColors(palette: LabelPalette, label: string) {
  const tone = labelTone(label);
  if (tone === "brand") return { bg: palette.accent, edge: palette.infoEdge, fg: palette.primary, dot: palette.primary };
  if (tone === "neutral") return { bg: palette.secondary, edge: palette.border, fg: palette.secondaryForeground, dot: palette.muted };
  return { bg: "transparent", edge: palette.border, fg: palette.foreground, dot: palette.foreground };
}

export type Reorder = "top" | "up" | "down";

/**
 * Where a task lands when moved inside its column, as projects.moveTask's
 * `afterId` reads it (null: first). `undefined` when it cannot move that way.
 */
export function reorderAfter(ids: readonly string[], id: string, to: Reorder): string | null | undefined {
  const index = ids.indexOf(id);
  if (index < 0) return undefined;
  if (to === "top" || to === "up") {
    if (index === 0) return undefined;
    if (to === "top") return null;
    return index >= 2 ? ids[index - 2] : null;
  }
  return index < ids.length - 1 ? ids[index + 1] : undefined;
}
