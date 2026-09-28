import { z } from "zod";
import { payerAddress } from "../billing/billing-rules";

export const companyAddress = payerAddress
  .omit({ numDiasAgenda: true })
  .extend({
    complemento: z.string().trim().max(30).default(""),
    codigoMunicipio: z
      .string()
      .trim()
      .regex(/^$|^\d{7}$/, "Informe o código IBGE com 7 dígitos.")
      .default(""),
  });
export type CompanyAddress = z.infer<typeof companyAddress>;

export function companyBillingInput(form: FormData) {
  const raw = Object.fromEntries(
    Object.keys(companyAddress.shape).map((key) => [
      key,
      String(form.get(key) ?? "").trim(),
    ]),
  );
  const hasAddress = Object.values(raw).some(Boolean);
  const parsed = hasAddress ? companyAddress.safeParse(raw) : null;
  if (parsed && !parsed.success)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["billingAddress"],
        message:
          "Complete o endereço do cliente: logradouro, número, bairro, cidade, UF e CEP válido. O código IBGE, se informado, deve ter 7 dígitos.",
      },
    ]);
  return {
    billingAddress: parsed?.success ? parsed.data : null,
    autoIssueNfse: form.get("autoIssueNfse") === "yes",
  };
}

export function addressLabel(address: CompanyAddress) {
  return `${address.endereco}, ${address.numero}${address.complemento ? `, ${address.complemento}` : ""} — ${address.bairro}, ${address.cidade}/${address.uf} — CEP ${address.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`;
}
