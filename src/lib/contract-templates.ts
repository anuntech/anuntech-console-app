/** The placeholders a contract template may use, and what fills them. */
export const CONTRACT_VARIABLES = [
  { key: "empresa", label: "Nome da empresa cliente" },
  { key: "cnpj", label: "CNPJ ou CPF do cliente" },
  { key: "endereco", label: "Endereço de cobrança do cliente" },
  { key: "produto", label: "Produto, serviço ou projeto vinculado" },
  { key: "valor", label: "Valor do vínculo" },
  { key: "ciclo", label: "Ciclo de cobrança (mensal ou anual)" },
  { key: "data", label: "Data de hoje, por extenso" },
  { key: "anuntech", label: "Razão social da Anuntech" },
  { key: "anuntech_cnpj", label: "CNPJ da Anuntech" },
  { key: "anuntech_endereco", label: "Endereço da Anuntech" },
] as const;
export type ContractVariable = (typeof CONTRACT_VARIABLES)[number]["key"];
export type ContractValues = Partial<Record<ContractVariable, string>>;

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Replaces the known placeholders; unknown or empty ones stay for review. */
export function fillContractTemplate(body: string, values: ContractValues) {
  return body.replace(PLACEHOLDER, (match, key: string) => {
    const value = values[key as ContractVariable];
    return value ? value : match;
  });
}

/** Placeholders still present in a text, so the editor can point at them. */
export function pendingContractVariables(body: string) {
  return [...new Set([...body.matchAll(PLACEHOLDER)].map((m) => `{{${m[1]}}}`))];
}
