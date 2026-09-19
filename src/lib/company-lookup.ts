import { z } from "zod";
import { payerAddress } from "./billing-rules";
export const lookupFields = z.object({
  name: z.string().max(160).optional(),
  endereco: z.string().max(100).optional(),
  numero: z.string().max(10).optional(),
  complemento: z.string().max(30).optional(),
  bairro: z.string().max(60).optional(),
  cidade: z.string().max(60).optional(),
  uf: payerAddress.shape.uf.optional(),
  cep: z
    .string()
    .regex(/^\d{8}$/)
    .optional(),
  codigoMunicipio: z
    .string()
    .regex(/^\d{7}$/)
    .optional(),
});
export type LookupFields = z.infer<typeof lookupFields>;
export type LookupKind = "cnpj" | "cep";
export const digits = (value: string) => value.replace(/\D/g, "");
const optionalText = z.string().nullish();
export function normalizeCnpj(value: unknown, cnpj: string): LookupFields {
  const data = z
    .object({
      razao_social: z.string().min(1),
      estabelecimento: z.object({
        cnpj: z.literal(cnpj),
        tipo_logradouro: optionalText,
        logradouro: optionalText,
        numero: optionalText,
        complemento: optionalText,
        bairro: optionalText,
        cep: optionalText,
        estado: z.object({ sigla: z.string() }),
        cidade: z.object({
          nome: z.string(),
          ibge_id: z.union([z.string(), z.number()]).nullish(),
        }),
      }),
    })
    .parse(value);
  const e = data.estabelecimento;
  return lookupFields.parse({
    name: data.razao_social,
    endereco:
      [e.tipo_logradouro, e.logradouro].filter(Boolean).join(" ").trim() ||
      undefined,
    numero: e.numero || undefined,
    complemento: e.complemento || undefined,
    bairro: e.bairro || undefined,
    cidade: e.cidade.nome,
    uf: e.estado.sigla,
    cep: e.cep ? digits(e.cep) : undefined,
    codigoMunicipio: e.cidade.ibge_id ? String(e.cidade.ibge_id) : undefined,
  });
}
export function normalizeCep(value: unknown, cep: string): LookupFields {
  const data = z
    .object({
      cep: z.string(),
      logradouro: optionalText,
      bairro: optionalText,
      localidade: z.string(),
      uf: z.string(),
      ibge: optionalText,
    })
    .parse(value);
  if (digits(data.cep) !== cep) throw Error("Mismatched CEP");
  // ViaCEP complemento describes a street segment, not the customer's unit.
  return lookupFields.parse({
    cep,
    endereco: data.logradouro || undefined,
    bairro: data.bairro || undefined,
    cidade: data.localidade,
    uf: data.uf,
    codigoMunicipio: data.ibge || undefined,
  });
}

export function mergeLookupFields<T extends Record<string, string>>(
  current: T,
  result: LookupFields,
  before: Record<string, number>,
  now: Record<string, number>,
): T {
  const merged = { ...current };
  for (const [key, value] of Object.entries(result)) {
    if (value && (before[key] || 0) === (now[key] || 0))
      merged[key as keyof T] = value as T[keyof T];
  }
  return merged;
}
