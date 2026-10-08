import { CONTRACT_VARIABLES } from "./contract-templates";

/*
 * The {{placeholders}} still in a contract draft, as fields the team fills
 * at the top of the page instead of hunting for them in a long text. Pure:
 * the editor and the tests share it.
 */

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const occurrences = (key: string) => new RegExp(`\\{\\{\\s*${escape(key)}\\s*\\}\\}`, "g");

/** Accents and spellings the placeholder names leave out ("numero" is "número"). */
const WORDS: Record<string, string> = {
  numero: "número",
  opcao: "opção",
  integracoes: "integrações",
  producao: "produção",
  usuario: "usuário",
  repositorio: "repositório",
  criterios: "critérios",
  dependencias: "dependências",
  responsavel: "responsável",
  email: "e-mail",
  mudanca: "mudança",
  preco: "preço",
  entregaveis: "entregáveis",
  ultimo: "último",
  remobilizacao: "remobilização",
  administracao: "administração",
  transicao: "transição",
  operacoes: "operações",
  sensiveis: "sensíveis",
  referencia: "referência",
  inicio: "início",
  vigencia: "vigência",
  servico: "serviço",
  servicos: "serviços",
  periodo: "período",
  metodo: "método",
  minimo: "mínimo",
  maximo: "máximo",
  tecnico: "técnico",
  tecnicos: "técnicos",
  publico: "público",
  pagina: "página",
  paginas: "páginas",
  codigo: "código",
  orcamento: "orçamento",
  licenca: "licença",
  licencas: "licenças",
  rescisao: "rescisão",
  manutencao: "manutenção",
  migracao: "migração",
  implantacao: "implantação",
  configuracao: "configuração",
  descricao: "descrição",
  observacoes: "observações",
  indice: "índice",
};

const known = new Map<string, string>(CONTRACT_VARIABLES.map((v) => [v.key, v.label]));

/** "numero_proposta" → "Número da proposta"; the Console's own fields keep their label. */
export function fieldLabel(key: string) {
  const own = known.get(key);
  if (own) return own;
  const words = key.split("_").filter(Boolean).map((word) => WORDS[word] ?? word);
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Fields that usually take a paragraph or a list rather than a few words. */
const LONG = /escopo|contexto|objetivo|premissa|dependencia|entregaveis|criterio|integracoes|tecnologias|operacoes|categorias|materiais|componentes|plataformas|compatibilidade|acessibilidade|titulares|suboperadores|ambiente|treinamento|manual|hospedagem|valores_hora|observacoes|descricao/;

export type ContractField = {
  key: string;
  label: string;
  /** How many times the placeholder appears in the text. */
  count: number;
  /** Where it first appears, to read it in place: the text right before and after it in its paragraph. */
  before: string;
  after: string;
  long: boolean;
};

const CONTEXT = 70;

/** The placeholders still in a text, in the order they first appear. */
export function contractFields(body: string): ContractField[] {
  const fields = new Map<string, ContractField>();
  for (const match of body.matchAll(PLACEHOLDER)) {
    const key = match[1];
    const field = fields.get(key);
    if (field) {
      field.count += 1;
      continue;
    }
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = body.indexOf("\n", end);
    const paragraphEnd = lineEnd === -1 ? body.length : lineEnd;
    const beforeRaw = body.slice(Math.max(lineStart, start - CONTEXT), start);
    const afterRaw = body.slice(end, Math.min(paragraphEnd, end + CONTEXT));
    fields.set(key, {
      key,
      label: fieldLabel(key),
      count: 1,
      before: (start - CONTEXT > lineStart ? "…" : "") + beforeRaw.replace(PLACEHOLDER, "…"),
      after: afterRaw.replace(PLACEHOLDER, "…") + (end + CONTEXT < paragraphEnd ? "…" : ""),
      long: LONG.test(key),
    });
  }
  return [...fields.values()];
}

/** Puts each filled value in place of its placeholder, everywhere it appears. Empty values change nothing. */
export function applyContractFields(body: string, values: Record<string, string>) {
  let next = body;
  let applied = 0;
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (!value || !/^[a-z_]+$/.test(key)) continue;
    const pattern = occurrences(key);
    if (!pattern.test(next)) continue;
    // A function keeps "$" in a value (R$ 1.000,00) from being read as a replacement pattern.
    next = next.replace(occurrences(key), () => value);
    applied += 1;
  }
  return { body: next, applied };
}

/** Takes a placeholder that does not apply out of the text, with the space it leaves. */
export function removeContractField(body: string, key: string) {
  if (!/^[a-z_]+$/.test(key)) return body;
  return body.replace(new RegExp(`[ \\t]?\\{\\{\\s*${escape(key)}\\s*\\}\\}`, "g"), "");
}

/** Where the placeholder first appears, to select it in the textarea. */
export function fieldRange(body: string, key: string): [number, number] | null {
  const match = occurrences(key).exec(body);
  return match ? [match.index, match.index + match[0].length] : null;
}
