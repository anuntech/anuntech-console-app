import { dateLabel } from "../format";
import type { SuspensionReason } from "./suspension-rules";

/** A suspended product as the client reads it: since when, why, and whether they can pay it. */
export type SuspendedProduct = { name: string; since: string | null; reason: SuspensionReason; canPay: boolean };

/**
 * What the client reads while something is suspended (Produtos on the web,
 * the products list and a product's screen in the app): why, and the two ways
 * out. "Pagar agora" only for an Administrador, and only for a late payment.
 * Client-safe and pure, so both screens say the same words.
 */
export function suspensionNotice(products: SuspendedProduct[]) {
  if (!products.length) return null;
  const overdue = products.some((p) => p.reason === "overdue");
  const first = products[0];
  return {
    title:
      products.length === 1
        ? `${first.name} está suspenso${first.since ? ` desde ${dateLabel(new Date(first.since))}` : ""}${first.reason === "overdue" ? ", por atraso no pagamento" : ""}.`
        : `${products.length} produtos estão suspensos: ${products.map((p) => p.name).join(", ")}.`,
    text: `Nenhum dado foi apagado. ${overdue ? "Assim que as faturas vencidas forem pagas, a equipe reativa." : "Para reativar, fale com a equipe."} O Console e os chamados continuam funcionando.`,
    canPay: products.some((p) => p.canPay && p.reason === "overdue"),
  };
}
