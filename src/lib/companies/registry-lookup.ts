import "server-only";
import { reserveHourly } from "../http/hourly-limit";
import { normalizeCep, normalizeCnpj, type LookupFields } from "./company-lookup";

/*
 * CNPJ (CNPJ.ws) and CEP (ViaCEP) lookups that fill a registration: the web's
 * /api/cadastro/consulta and the app's company.lookupCep.
 */

export type RegistryLookup = { fields: LookupFields } | { error: string; status: 400 | 404 | 429 | 502 };

export const CEP_LIMIT_MESSAGE = "Muitas consultas na última hora. Preencha o endereço manualmente.";

/** A client fills the address by CEP at most 20 times an hour (the team has no limit). */
export function reserveCepLookup(userId: string) {
  return reserveHourly("cep", userId, 20);
}

export async function lookupRegistry(kind: string | null, value: string): Promise<RegistryLookup> {
  if (!(
    (kind === "cnpj" && /^\d{14}$/.test(value)) ||
    (kind === "cep" && /^\d{8}$/.test(value))
  ))
    return { error: "Informe um CNPJ com 14 dígitos ou CEP com 8 dígitos.", status: 400 };
  try {
    const url =
      kind === "cnpj"
        ? `https://publica.cnpj.ws/cnpj/${value}`
        : `https://viacep.com.br/ws/${value}/json/`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      cache: "no-store",
    });
    if (res.status === 429)
      return {
        error: "Limite de consultas atingido. Aguarde um minuto ou preencha manualmente.",
        status: 429,
      };
    if (res.status === 404)
      return {
        error: `${kind === "cnpj" ? "CNPJ" : "CEP"} não encontrado. Confira o número ou preencha manualmente.`,
        status: 404,
      };
    if (!res.ok) throw Error();
    const data = await res.json();
    if (data.erro)
      return { error: "CEP não encontrado. Confira o número ou preencha manualmente.", status: 404 };
    return { fields: kind === "cnpj" ? normalizeCnpj(data, value) : normalizeCep(data, value) };
  } catch {
    return {
      error: "A consulta está indisponível no momento. Tente novamente ou preencha os dados manualmente.",
      status: 502,
    };
  }
}
