import { z } from "zod";
export const onlyDigits = (value: string) => value.replace(/\D/g, "");
export const phoneDigits = (value: string) => {
  const n = onlyDigits(value);
  return n.startsWith("55") && n.length > 11 ? n.slice(2) : n;
};
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
export function formatPhone(value: string) {
  const n = phoneDigits(value).slice(0, 11);
  if (!n) return "";
  if (n.length <= 2) return `(${n}`;
  const local = n.slice(2),
    split = n.length > 10 ? 5 : 4;
  return `(${n.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? "-" + local.slice(split) : ""}`;
}
export const companyPhone = z
  .string()
  .transform(phoneDigits)
  .pipe(
    z
      .string()
      .regex(
        /^[1-9]{2}(?:[2-9]\d{7}|9\d{8})$/,
        "Informe telefone com DDD e 10 ou 11 dígitos.",
      ),
  );
export const companyEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Informe um e-mail válido."));
export const companyIdentity = z.object({
  name: z.string().trim().min(1, "Informe o nome ou razão social.").max(160),
  document: z
    .string()
    .transform(onlyDigits)
    .pipe(
      z
        .string()
        .regex(
          /^(\d{11}|\d{14})$/,
          "Informe CPF ou CNPJ com 11 ou 14 dígitos.",
        ),
    ),
  billingEmail: companyEmail,
  phone: companyPhone,
});
export type CompanyRegistration = z.infer<typeof companyIdentity> & {
  billingAddress: import("./company-billing").CompanyAddress | null;
};
