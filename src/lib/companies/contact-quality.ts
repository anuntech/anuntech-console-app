import { onlyDigits } from "./company-input";

/*
 * Checks on a client's record and notice contacts that make notices or
 * boletos fail without anyone noticing. Pure: the team's lists and the tests
 * share it. Nothing here changes a contact; it only points.
 */

/** CPF (11 digits) or CNPJ (14) with valid check digits. */
export function validDocument(value: string) {
  const digits = onlyDigits(value);
  if (/^(\d)\1+$/.test(digits)) return false;
  if (digits.length === 11) {
    const check = (length: number) => {
      const sum = [...digits.slice(0, length)].reduce((acc, d, i) => acc + Number(d) * (length + 1 - i), 0);
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
  }
  if (digits.length === 14) {
    const check = (length: number) => {
      const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
  }
  return false;
}

/** A Brazilian landline: 10 digits (area code + 8), or a number whose first digit after the area code is not 9. WhatsApp does not reach it. */
export function isLandline(phone: string) {
  let digits = onlyDigits(phone);
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 10) return true;
  return digits.length === 11 && digits[2] !== "9";
}

export type NoticeContacts = { topic: "billing" | "tickets"; emails: string[]; phones: string[]; whatsappEnabled: boolean; emailEnabled: boolean };

/** What to fix in a client's contacts, in plain words; empty when all is fine. */
export function contactProblems(company: { document: string; billingEmail: string }, contacts: NoticeContacts[]) {
  const problems: string[] = [];
  if (!validDocument(company.document)) problems.push("CPF/CNPJ com dígito verificador inválido");
  for (const c of contacts) {
    const subject = c.topic === "billing" ? "Financeiro" : "Chamados";
    const landlines = c.whatsappEnabled ? c.phones.filter(isLandline) : [];
    if (landlines.length) problems.push(`telefone fixo como WhatsApp de ${subject}: ${landlines.join(", ")}`);
    const ours = c.emails.filter((email) => /@anuntech\.com(\.br)?$/i.test(email));
    if (ours.length) problems.push(`e-mail da Anuntech entre os contatos de ${subject} do cliente: ${ours.join(", ")}`);
  }
  const billing = contacts.find((c) => c.topic === "billing");
  if (billing?.emailEnabled && billing.emails.length && !billing.emails.some((e) => e.toLowerCase() === company.billingEmail.toLowerCase()))
    problems.push(`o e-mail financeiro do cadastro (${company.billingEmail}) não recebe os avisos de cobrança`);
  return problems;
}
