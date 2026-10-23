import { formatDocument, onlyDigits } from "./br-input";
import { money } from "./format";

/*
 * The lines of the web's proposal document (src/components/orcamentos/quote-document.tsx)
 * that the app writes the same way.
 */

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
const longDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "CNPJ 12.345.678/0001-90" or "CPF 123.456.789-09"; null when there is none. */
export function documentLine(document: string | null | undefined) {
  const digits = onlyDigits(document ?? "");
  if (!digits) return null;
  return `${digits.length > 11 ? "CNPJ" : "CPF"} ${formatDocument(digits)}`;
}

/** Under "Total estimado do projeto": "60h × R$ 150,00/h, com R$ 900,00 de desconto". */
export function rateLine(hoursMax: number, hourlyRateCents: number, discountCents: number) {
  return `${hoursMax}h × ${money(hourlyRateCents)}/h${discountCents > 0 ? `, com ${money(discountCents)} de desconto` : ""}`;
}

/**
 * The footer: "Proposta preparada pela Anuntech · 23/10/2026 · válida até 10 de novembro de 2026".
 * `prepared` is when it was sent (or last changed); `validUntil` a civil date.
 */
export function preparedLine(prepared: string, validUntil: string | null) {
  const valid = validUntil ? ` · válida até ${longDate.format(new Date(`${validUntil}T12:00:00Z`))}` : "";
  return `Proposta preparada pela Anuntech · ${shortDate.format(new Date(prepared))}${valid}`;
}
