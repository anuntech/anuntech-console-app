import { z } from "zod";
import { DEFAULT_PAGE_SIZE, listHref, setPageParams, type PageQuery } from "./list-query";

/* ---------- shape ---------- */

export type QuoteTask = { title: string; description: string };
export type QuotePhase = {
  name: string;
  description: string;
  hoursMin: number;
  hoursMax: number;
  tasks: QuoteTask[];
};
/** What the editor produces and the proposal is built from. */
export type QuoteContent = {
  summary: string;
  stack: string[];
  phases: QuotePhase[];
  hourlyRateCents: number;
  /** Share of the total charged up front, 0–100. */
  upfrontPercent: number;
  /** Small print under the total. */
  notes: string;
};
/** The proposal as it went out: the content plus what names it. */
export type QuotePublication = QuoteContent & {
  title: string;
  number: string;
  companyName: string;
  companyDocument: string;
  validUntil: string | null;
  version: number;
};

export const DEFAULT_QUOTE_NOTES =
  "Estimativas de esforço e investimento. Escopo final definido na reunião de descoberta.";

export const emptyQuoteContent = (): QuoteContent => ({
  summary: "",
  stack: [],
  phases: [],
  hourlyRateCents: 0,
  upfrontPercent: 50,
  notes: DEFAULT_QUOTE_NOTES,
});

const line = z.string().trim().max(160, "Use até 160 caracteres.");
const paragraph = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n"))
  .pipe(z.string().trim().max(4000, "Use até 4 mil caracteres."));
const hours = z.number().int("Horas inteiras.").min(0).max(100000);

export const quoteContentSchema = z.object({
  summary: paragraph.default(""),
  stack: z.array(line.min(1)).max(40, "Até 40 tecnologias.").default([]),
  phases: z
    .array(
      z
        .object({
          name: line.min(1, "Dê um nome a cada fase."),
          description: paragraph.default(""),
          hoursMin: hours,
          hoursMax: hours,
          tasks: z
            .array(
              z.object({
                title: line.min(1, "Dê um título a cada tarefa."),
                description: paragraph.default(""),
              }),
            )
            .max(200)
            .default([]),
        })
        .refine((phase) => phase.hoursMax >= phase.hoursMin, {
          message: "Em cada fase, as horas máximas não podem ficar abaixo das mínimas.",
          path: ["hoursMax"],
        }),
    )
    .max(60, "Até 60 fases.")
    .default([]),
  hourlyRateCents: z.number().int().min(0).max(99999999),
  upfrontPercent: z.number().int().min(0).max(100),
  notes: paragraph.default(""),
});

/* ---------- arithmetic ---------- */

export type QuoteTotals = {
  hoursMin: number;
  hoursMax: number;
  phases: number;
  tasks: number;
  totalCents: number;
  upfrontCents: number;
  balanceCents: number;
};

/**
 * The numbers the proposal prints. The price is the top of the estimate
 * times the rate (a 48–60h project at R$ 40/h is R$ 2.400), split between
 * the up-front share and the balance.
 */
export function quoteTotals(
  content: Pick<QuoteContent, "phases" | "hourlyRateCents" | "upfrontPercent">,
): QuoteTotals {
  const hoursMin = content.phases.reduce((sum, phase) => sum + phase.hoursMin, 0);
  const hoursMax = content.phases.reduce((sum, phase) => sum + phase.hoursMax, 0);
  const tasks = content.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
  const totalCents = hoursMax * content.hourlyRateCents;
  const upfrontCents = Math.round((totalCents * content.upfrontPercent) / 100);
  return {
    hoursMin,
    hoursMax,
    phases: content.phases.length,
    tasks,
    totalCents,
    upfrontCents,
    balanceCents: totalCents - upfrontCents,
  };
}

/** "48–60h", or "10h" when the estimate is exact. */
export const hoursLabel = (min: number, max: number) => (min === max ? `${max}h` : `${min}–${max}h`);

/** "2026-007" */
export const quoteNumberLabel = (year: number, seq: number) => `${year}-${String(seq).padStart(3, "0")}`;

/** "P5-01": the task's address inside the proposal. */
export const taskCode = (phaseIndex: number, taskIndex: number) =>
  `P${phaseIndex + 1}-${String(taskIndex + 1).padStart(2, "0")}`;

/* ---------- status and validity ---------- */

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "cancelled";
export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "Rascunho",
  sent: "Aguardando resposta",
  accepted: "Aceito",
  declined: "Recusado",
  cancelled: "Cancelado",
};

/** The situation filters; "expired" derives from the validity date. */
export type QuoteStatusFilter = "all" | QuoteStatus | "expired";
export const quoteFilters: QuoteStatusFilter[] = ["all", "sent", "accepted", "declined", "expired", "draft", "cancelled"];
export const quoteFilterLabels: Record<QuoteStatusFilter, string> = {
  all: "Todas as situações",
  sent: "Aguardando resposta",
  accepted: "Aceitos",
  declined: "Recusados",
  expired: "Expirados",
  draft: "Rascunhos",
  cancelled: "Cancelados",
};

export type QuoteValidity = { state: "none" } | { state: "open"; days: number } | { state: "expired"; days: number };

const DAY = 86400000;
const civil = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** Where a proposal stands against its validity date; `days` counts to that date. */
export function quoteValidity(validUntil: string | null, today: string): QuoteValidity {
  if (!validUntil) return { state: "none" };
  const days = Math.round((civil(validUntil) - civil(today)) / DAY);
  return days < 0 ? { state: "expired", days } : { state: "open", days };
}

/** "Válido por 12 dias", "Válido até hoje", "Expirou há 3 dias" … for badges. */
export function quoteValidityLabel(validity: QuoteValidity) {
  switch (validity.state) {
    case "open":
      return validity.days === 0
        ? "Válido até hoje"
        : validity.days === 1
          ? "Válido até amanhã"
          : `Válido por ${validity.days} dias`;
    case "expired":
      return validity.days === -1 ? "Expirou ontem" : `Expirou há ${-validity.days} dias`;
    default:
      return null;
  }
}

/** A proposal still waiting for an answer past its validity date. */
export const quoteExpired = (status: QuoteStatus, validUntil: string | null, today: string) =>
  status === "sent" && quoteValidity(validUntil, today).state === "expired";

/* ---------- list query ---------- */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function quoteQuery(params: Record<string, string | string[] | undefined>) {
  const scalar = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const company = scalar("company");
  return {
    status: (quoteFilters.includes(scalar("status") as QuoteStatusFilter) ? scalar("status") : "all") as QuoteStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    company: UUID.test(company) ? company.toLowerCase() : "",
  };
}
export type QuoteQuery = ReturnType<typeof quoteQuery>;
/** The list's URL; `page`/`size` are kept when given (the list's own links), left out otherwise. */
export function quoteListHref({ status, search, company, page = 1, pageSize = DEFAULT_PAGE_SIZE }: QuoteQuery & Partial<PageQuery>) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (company) params.set("company", company);
  if (search) params.set("q", search);
  return listHref("/orcamentos", setPageParams(params, { page, pageSize }));
}
