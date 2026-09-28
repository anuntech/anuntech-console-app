import { z } from "zod";
export const payerAddress = z.object({
  endereco: z.string().trim().min(1).max(100),
  numero: z.string().trim().min(1).max(10),
  complemento: z.string().trim().max(30).default(""),
  bairro: z.string().trim().min(1).max(60),
  cidade: z.string().trim().min(1).max(60),
  cep: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{8}$/)),
  uf: z.enum([
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
  ]),
  numDiasAgenda: z.coerce.number().int().min(0).max(60),
});
export function bankReference(invoiceId: string) {
  return invoiceId.replace(/-/g, "").slice(0, 15);
}
export function bankInvoiceStatus(
  status: string,
): "paid" | "cancelled" | "issued" {
  // MARCADO_RECEBIDO is a manual marking in the bank, not proof of payment.
  if (status === "RECEBIDO") return "paid";
  if (["CANCELADO", "EXPIRADO", "FALHA_EMISSAO"].includes(status))
    return "cancelled";
  return "issued";
}
export const bankCharge = z.object({
  cobranca: z.object({
    codigoSolicitacao: z.string().uuid(),
    seuNumero: z.string(),
    valorNominal: z.union([z.string(), z.number()]),
    dataVencimento: z.iso.date(),
    situacao: z.enum([
      "RECEBIDO",
      "A_RECEBER",
      "MARCADO_RECEBIDO",
      "ATRASADO",
      "CANCELADO",
      "EXPIRADO",
      "FALHA_EMISSAO",
      "EM_PROCESSAMENTO",
      "PROTESTO",
    ]),
    pagador: z.object({ cpfCnpj: z.string() }),
  }),
  boleto: z
    .object({
      linhaDigitavel: z
        .string()
        .regex(/^\d{47}$/)
        .optional(),
    })
    .nullish(),
  pix: z.object({ pixCopiaECola: z.string().max(2000).optional() }).nullish(),
});

/** Inter's charge situations, plus the Console's own request states. */
export const bankStatusLabels: Record<string, string> = {
  A_RECEBER: "A receber",
  RECEBIDO: "Recebido",
  MARCADO_RECEBIDO: "Marcado como recebido no banco",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
  FALHA_EMISSAO: "Falha na emissão",
  EM_PROCESSAMENTO: "Em processamento",
  PROTESTO: "Em protesto",
  ENVIANDO: "Enviando ao banco",
  RECUSADA: "Recusada pelo banco",
  RESPOSTA_INDEFINIDA: "Sem resposta do banco",
};
