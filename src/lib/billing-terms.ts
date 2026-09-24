import { z } from "zod";
import { moneyToCents } from "./permissions";

/** A discount until the due date, and fine + monthly interest after it (basis points). */
export type ChargeTerms = {
  discountCents: number | null;
  fineBps: number | null;
  interestMonthlyBps: number | null;
};
export const noChargeTerms: ChargeTerms = {
  discountCents: null,
  fineBps: null,
  interestMonthlyBps: null,
};

/** "2" or "1,5" → 200 or 150 basis points; empty → null. */
function percentToBps(value: string) {
  const text = value.trim();
  if (!text) return null;
  const n = Number(text.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("Informe um percentual entre 0 e 100.");
  return Math.round(n * 100);
}

/**
 * Reads the charge terms from a form: `discount` (money), `lateFees`
 * (switch), `finePercent` and `interestPercent`. Throws with a message the
 * form can show. `amountCents` bounds the discount.
 */
export function parseChargeTerms(form: FormData, amountCents: number): ChargeTerms {
  const input = z
    .object({
      discount: z.string().trim().max(20).default(""),
      lateFees: z.string().optional(),
      finePercent: z.string().trim().max(8).default(""),
      interestPercent: z.string().trim().max(8).default(""),
    })
    .parse({
      discount: form.get("discount") ?? "",
      lateFees: form.get("lateFees") ?? undefined,
      finePercent: form.get("finePercent") ?? "",
      interestPercent: form.get("interestPercent") ?? "",
    });
  let discountCents: number | null = null;
  if (input.discount) {
    discountCents = moneyToCents(input.discount);
    if (discountCents === null) throw new Error("Informe um desconto válido.");
    if (discountCents >= amountCents) throw new Error("O desconto precisa ser menor que o valor da fatura.");
  }
  const late = input.lateFees === "on" || input.lateFees === "true";
  const fineBps = late ? percentToBps(input.finePercent) : null;
  const interestMonthlyBps = late ? percentToBps(input.interestPercent) : null;
  if (late && fineBps === null && interestMonthlyBps === null)
    throw new Error("Informe a multa ou os juros ao mês.");
  return { discountCents, fineBps: fineBps || null, interestMonthlyBps: interestMonthlyBps || null };
}

/** "this" applies to one invoice; "all" also to the recurrence's next periods. */
export function parseTermsScope(form: FormData): "this" | "all" {
  return form.get("termsScope") === "all" ? "all" : "this";
}

export const sameTerms = (a: ChargeTerms, b: ChargeTerms) =>
  a.discountCents === b.discountCents &&
  a.fineBps === b.fineBps &&
  a.interestMonthlyBps === b.interestMonthlyBps;

export const hasTerms = (terms: ChargeTerms) =>
  terms.discountCents != null || terms.fineBps != null || terms.interestMonthlyBps != null;

const percentLabel = (bps: number) => `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** "multa de 2% e juros de 1% ao mês" */
export function lateFeesLabel(terms: ChargeTerms) {
  const parts = [];
  if (terms.fineBps) parts.push(`multa de ${percentLabel(terms.fineBps)}`);
  if (terms.interestMonthlyBps) parts.push(`juros de ${percentLabel(terms.interestMonthlyBps)} ao mês`);
  return parts.join(" e ");
}

/**
 * The Inter cobrança v3 fields for these terms. The discount is a fixed
 * amount valid until the due date (`quantidadeDias: 0`); after it, the
 * fine is a percentage of the amount and the interest a monthly rate.
 */
export function interChargeTerms(terms: ChargeTerms) {
  const fields: Record<string, unknown> = {};
  if (terms.discountCents)
    fields.desconto = {
      codigo: "VALORFIXODATAINFORMADA",
      quantidadeDias: 0,
      valor: terms.discountCents / 100,
      taxa: 0,
    };
  if (terms.fineBps) fields.multa = { codigo: "PERCENTUAL", valor: 0, taxa: terms.fineBps / 100 };
  if (terms.interestMonthlyBps)
    fields.mora = { codigo: "TAXAMENSAL", valor: 0, taxa: terms.interestMonthlyBps / 100 };
  return fields;
}
