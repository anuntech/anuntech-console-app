import { payerAddress } from "./billing-rules";

/*
 * Whether a company's record lets Inter issue a charge: the same checks the
 * publication makes (billing-publish.ts), so a warning days ahead and the
 * refusal on the day never disagree. Pure: the digest, the screens and the
 * tests share it.
 */

export type BillingProblem = "archived" | "name" | "document" | "address";

export const billingProblemLabels: Record<BillingProblem, string> = {
  archived: "empresa arquivada",
  name: "razão social com mais de 100 caracteres",
  document: "CPF ou CNPJ inválido",
  address: "endereço de cobrança incompleto",
};

const address = payerAddress.omit({ numDiasAgenda: true });

export function billingReadiness(company: { name: string; document: string; archived: boolean; billingAddress: unknown }): BillingProblem[] {
  const problems: BillingProblem[] = [];
  if (company.archived) problems.push("archived");
  if (company.name.length > 100) problems.push("name");
  if (!/^(\d{11}|\d{14})$/.test(company.document)) problems.push("document");
  if (!address.safeParse(company.billingAddress).success) problems.push("address");
  return problems;
}

/** "endereço de cobrança incompleto e CPF ou CNPJ inválido". */
export function billingProblemsLabel(problems: BillingProblem[]) {
  const labels = problems.map((p) => billingProblemLabels[p]);
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}` : (labels[0] ?? "");
}
