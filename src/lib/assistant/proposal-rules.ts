import { createHash } from "node:crypto";

/*
 * Pure rules for the assistant's confirmation cards: how a tool call is
 * fingerprinted and how it is written for the person who decides. The server
 * side (storage, nonce, execution) is in assistant-proposals.ts.
 */

/** How long a card can be confirmed (apart, so the panel in the browser reads it too). */
export { PROPOSAL_TTL_MS } from "./proposal-ttl";

/** JSON with the keys sorted at every depth: the same call always reads the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  return JSON.stringify(value ?? null);
}

/** One approval covers one call: this tool with exactly these arguments. */
export function callHash(tool: string, args: unknown) {
  return createHash("sha256").update(`${tool}\n${canonicalJson(args)}`).digest("hex");
}

/** What each card says it will do. Fixed per tool: the arguments only appear in the details. */
export const proposalLabels: Record<string, string> = {
  abrir_chamado: "Abrir um chamado",
  responder_chamado: "Enviar uma mensagem no chamado",
  atualizar_chamado: "Alterar o chamado",
  registrar_horas: "Registrar horas",
  criar_tarefa: "Criar uma tarefa",
  mover_tarefa: "Mudar a situação da tarefa",
  atualizar_tarefa: "Alterar tarefas",
  excluir_tarefa: "Excluir a tarefa (não tem volta)",
  comentar_tarefa: "Comentar em tarefas",
  editar_comentario_tarefa: "Editar o comentário",
  excluir_comentario_tarefa: "Excluir o comentário (não tem volta)",
  criar_projeto: "Criar um projeto",
  atualizar_projeto: "Alterar o projeto",
  criar_orcamento: "Criar um orçamento em rascunho",
  atualizar_orcamento: "Alterar o orçamento em rascunho",
  duplicar_orcamento: "Duplicar o orçamento",
  criar_cobranca_rascunho: "Criar uma cobrança em rascunho (não emite no banco)",
  atualizar_cobranca_rascunho: "Alterar a cobrança em rascunho",
  cancelar_cobranca_rascunho: "Cancelar a cobrança em rascunho",
  cadastrar_empresa: "Cadastrar uma empresa",
  atualizar_empresa: "Alterar o cadastro da empresa",
  convidar_membro: "Dar acesso a uma pessoa",
  criar_bookmark: "Guardar um bookmark",
  criar_pasta_de_bookmarks: "Criar uma pasta de bookmarks",
  criar_item_do_catalogo: "Cadastrar um item no catálogo",
  vincular_item_do_catalogo: "Vincular um item do catálogo à empresa",
  criar_contrato_rascunho: "Criar um contrato em rascunho",
  definir_vigencia_contrato: "Definir a vigência do contrato",
  preencher_tela: "Preencher o formulário da tela",
  clicar_na_tela: "Clicar num botão da tela",
};

export const proposalLabel = (tool: string, args: Record<string, unknown>) =>
  tool === "preencher_tela" && args.enviar === true ? "Preencher e enviar o formulário da tela" : (proposalLabels[tool] ?? `Executar ${tool}`);

/** Argument names as the card shows them; the rest are split from camelCase. */
const fieldLabels: Record<string, string> = {
  companyId: "Empresa",
  chamadoId: "Chamado",
  engagementId: "Projeto",
  tarefaId: "Tarefa",
  tarefaIds: "Tarefas",
  faturaId: "Fatura",
  orcamentoId: "Orçamento",
  copiarDeOrcamentoId: "Copiar do orçamento",
  contratoId: "Contrato",
  comentarioId: "Comentário",
  catalogItemId: "Item do catálogo",
  pastaId: "Pasta",
  templateId: "Modelo",
  valorReais: "Valor (R$)",
  taxaHoraReais: "Taxa/hora (R$)",
  descontoReais: "Desconto (R$)",
  emailCobranca: "E-mail de cobrança",
  oQueFalta: "O que falta (o cliente lê)",
  oQueFoiFeito: "O que foi feito",
  responsavelEmail: "Responsável",
  descricao: "Descrição",
  titulo: "Título",
  situacao: "Situação",
  responsaveis: "Responsáveis",
  estimativaHoras: "Estimativa (horas)",
  observacoes: "Observações",
  inicio: "Início",
  pagarAte: "Pagar até",
  validoAte: "Válido até",
  entradaPercentual: "Entrada (%)",
  cobranca: "Cobrança",
  campos: "Campos",
  enviar: "Enviar o formulário",
  texto: "Texto",
  formulario: "Formulário",
};
const labelOf = (key: string) => {
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return fieldLabels[key] ?? words.charAt(0).toUpperCase() + words.slice(1);
};

const MAX_VALUE = 1500;
const clip = (text: string) => (text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text);

function valueText(value: unknown): string {
  if (value === true) return "sim";
  if (value === false) return "não";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object" || v === null)) return value.map(valueText).join(", ");
    // Form fields read as "campo: valor"; anything else as one compact line per item.
    return value
      .map((item) =>
        item && typeof item === "object" && "campo" in item && "valor" in item
          ? `${String((item as { campo: unknown }).campo)}: ${valueText((item as { valor: unknown }).valor)}`
          : canonicalJson(item),
      )
      .join("\n");
  }
  return canonicalJson(value);
}

/**
 * The card's lines: every argument, ids replaced by what they name (the
 * server resolves them with the person's access), long texts cut.
 */
export function proposalDetails(args: Record<string, unknown>, names: Record<string, string> = {}) {
  return Object.entries(args)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      label: labelOf(key),
      value: clip(
        Array.isArray(value) && value.every((v) => typeof v === "string" && names[v])
          ? value.map((v) => names[v as string]).join(", ")
          : typeof value === "string" && names[value]
            ? names[value]
            : valueText(value),
      ),
    }));
}
