// Brazilian documents, phones and CEPs as the web's company form draws them
// while typing (../src/lib/companies/company-input.ts). The app keeps digits in
// state and sends digits; the server validates.

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** A phone's digits without the country code 55 the server also strips. */
export const phoneDigits = (value: string) => {
  const n = onlyDigits(value);
  return n.startsWith("55") && n.length > 11 ? n.slice(2) : n;
};

/** CPF (000.000.000-00) or CNPJ (00.000.000/0000-00), by length. */
export function formatDocument(value: string) {
  const n = onlyDigits(value).slice(0, 14);
  return n.length > 11
    ? n
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
        .replace(/(\.\d{3})(\d)/, "$1/$2")
        .replace(/(\/\d{4})(\d)/, "$1-$2")
    : n
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
        .replace(/(\.\d{3})(\d)/, "$1-$2");
}

/** (11) 99999-9999 or (11) 3333-4444; never a trailing separator, so backspace works. */
export function formatPhoneInput(value: string) {
  const n = phoneDigits(value).slice(0, 11);
  if (!n) return "";
  if (n.length <= 2) return `(${n}`;
  const local = n.slice(2);
  const split = n.length > 10 ? 5 : 4;
  return `(${n.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? "-" + local.slice(split) : ""}`;
}

/** 00000-000 */
export function formatCep(value: string) {
  const n = onlyDigits(value).slice(0, 8);
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
}
