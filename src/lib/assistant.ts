import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import type { Actor } from "./access";
import { assistantDocuments, assistantSettings } from "@/db/schema";
import { saoPauloDate } from "./dates";
import { longDateLabel } from "./format";
import { hasPermission } from "./permissions";
import { runTool, toolCatalog, type ClientAction } from "./assistant-tools";

export const DEFAULT_ASSISTANT_MODEL = "anthropic/claude-sonnet-4.5";
const MAX_ROUNDS = 8;
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 6000;
/** Documents up to this size go straight into the prompt; beyond it, search only. */
const INLINE_DOCS_CHARS = 24000;

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type AssistantReply = {
  reply: string;
  steps: string[];
  actions: ClientAction[];
};

/* ---------- settings ---------- */

export async function assistantConfig() {
  const [row] = await db.select().from(assistantSettings).where(eq(assistantSettings.id, "default"));
  return {
    model: row?.model?.trim() || DEFAULT_ASSISTANT_MODEL,
    prompt: row?.prompt ?? "",
    updatedAt: row?.updatedAt ?? null,
    keyConfigured: !!process.env.OPENROUTER_API_KEY,
  };
}

/* ---------- rate limit (soft, per instance) ---------- */

const buckets = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 40;
export function allowRequest(userId: string) {
  const now = Date.now();
  const recent = (buckets.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_WINDOW) return false;
  recent.push(now);
  buckets.set(userId, recent);
  return true;
}

/* ---------- prompt ---------- */

/** Keeps the tail of the conversation, each turn trimmed, so the prompt stays bounded. */
export function trimHistory(turns: ChatTurn[]): ChatTurn[] {
  return turns
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_CHARS) }));
}

async function knowledge() {
  const docs = await db
    .select({ name: assistantDocuments.name, content: assistantDocuments.content, bytes: assistantDocuments.bytes })
    .from(assistantDocuments)
    .orderBy(assistantDocuments.name);
  const total = docs.reduce((sum, d) => sum + d.content.length, 0);
  if (!docs.length) return "Nenhum documento cadastrado. Para dúvidas sobre a Anuntech que você não sabe responder, ofereça o chat com a equipe.";
  if (total <= INLINE_DOCS_CHARS)
    return docs.map((d) => `### ${d.name}\n${d.content.trim()}`).join("\n\n");
  return `Documentos disponíveis (use buscar_conhecimento para ler trechos): ${docs.map((d) => d.name).join("; ")}.`;
}

export async function systemPrompt(actor: Actor, custom: string) {
  const today = saoPauloDate();
  const who = actor.admin
    ? "Quem fala com você é da equipe da Anuntech (acesso total a todas as empresas)."
    : `Quem fala com você é ${actor.user.name || actor.user.email}, cliente da Anuntech, com acesso a: ${actor.grants
        .map(
          (g) =>
            `${g.company.name} (companyId ${g.company.id}; ${g.role === "manager" ? "gestor" : "membro"}; pode ver ${[
              "visão geral",
              hasPermission(g.role, "support") ? "chamados" : null,
              hasPermission(g.role, "finance") ? "financeiro, contratos e orçamentos" : null,
            ]
              .filter(Boolean)
              .join(", ")})`,
        )
        .join("; ")}.`;
  return [
    `Você é o assistente do Anuntech Console, o portal onde os clientes da Anuntech acompanham produtos, projetos, chamados, faturas, contratos e orçamentos. A Anuntech é uma empresa brasileira de software: desenvolve sistemas sob medida e mantém produtos próprios (como o Synova).`,
    `Hoje é ${longDateLabel(today)} (${today}), fuso de São Paulo.`,
    who,
    `Nome de quem fala: ${actor.user.name || actor.user.email}. E-mail: ${actor.user.email}.`,
    "",
    "Como agir:",
    "- Responda em português do Brasil, de forma direta e curta. Sem enrolação, sem repetir a pergunta.",
    "- Use as ferramentas para consultar e agir; nunca invente dados, valores, situações de pagamento ou links. Se uma ferramenta devolver erro, explique em uma frase e sugira o caminho.",
    "- Links: use caminhos relativos do Console em Markdown, como [ver fatura](/financeiro/abc). O painel transforma em links reais. Para PDF de boleto use o link boletoPdf; para pagar use linkPagamento.",
    "- Quando a pessoa tem uma única empresa, não pergunte qual; use o companyId dela. Com várias, pergunte ou use listar_empresas.",
    "- Antes de ações que criam ou alteram algo (abrir_chamado, responder_chamado, criar_tarefa, mover_tarefa, criar_projeto), confirme o conteúdo com a pessoa, a não ser que o pedido já esteja completo e inequívoco. Depois de executar, diga o que foi feito com o link.",
    "- Cobranças, orçamentos, contratos e cadastros de empresa não são criados por você: leve a pessoa à tela com abrir_tela. Nunca diga que uma fatura foi paga se a situação não disser isso.",
    "- Se a pessoa quiser falar com alguém, ou se você não conseguir ajudar, use abrir_chat_suporte e diga que a equipe responde por ali.",
    "- Dúvidas sobre a Anuntech: responda com a base de conhecimento abaixo (ou buscar_conhecimento). Se não estiver lá, diga que não sabe e ofereça o chat com a equipe.",
    "- Valores em reais no formato R$ 1.234,56 e datas como 24/09/2026.",
    actor.admin
      ? "- Para a equipe da Anuntech você também organiza trabalho: pode montar um projeto inteiro (criar_projeto e depois uma criar_tarefa por tarefa, com prioridade, prazo e estimativa) a partir de uma descrição, e responder chamados em nome da equipe. Apresente o plano de tarefas antes de criar e execute quando a pessoa aprovar."
      : "",
    "",
    "Base de conhecimento da Anuntech:",
    await knowledge(),
    custom.trim() ? `\nInstruções da Anuntech:\n${custom.trim()}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/* ---------- the call ---------- */

type Message =
  | { role: "system" | "user" | "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export class AssistantError extends Error {}

async function complete(model: string, messages: Message[], tools: ReturnType<typeof toolCatalog>) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AssistantError("O assistente ainda não foi ligado: falta a chave do OpenRouter nas variáveis do ambiente.");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.BETTER_AUTH_URL || "https://console.anuntech.com",
      "X-Title": "Anuntech Console",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(90000),
  });
  const data = (await res.json().catch(() => null)) as
    | { choices?: { message: Message & { tool_calls?: ToolCall[] } }[]; error?: { message?: string } }
    | null;
  if (!res.ok || !data?.choices?.length) {
    const detail = data?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) throw new AssistantError("A chave do OpenRouter foi recusada. Confira em Configurações › Assistente.");
    if (res.status === 402) throw new AssistantError("O OpenRouter está sem créditos. Recarregue a conta para o assistente voltar.");
    if (res.status === 404 || /model/i.test(detail)) throw new AssistantError(`O modelo "${model}" não foi aceito pelo OpenRouter: ${detail}`);
    throw new AssistantError(`O OpenRouter não respondeu (${detail}). Tente de novo em instantes.`);
  }
  return data.choices[0].message;
}

/**
 * One turn of the conversation: the model answers, calling tools as many
 * times as it needs (bounded), every tool running with the caller's own
 * permissions. Returns the final text plus what was done along the way.
 */
export async function converse(actor: Actor, history: ChatTurn[]): Promise<AssistantReply> {
  const config = await assistantConfig();
  const tools = toolCatalog(actor);
  const messages: Message[] = [{ role: "system", content: await systemPrompt(actor, config.prompt) }, ...trimHistory(history)];
  const steps: string[] = [];
  const actions: ClientAction[] = [];
  const ctx = { actor, today: saoPauloDate() };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const message = await complete(config.model, messages, tools);
    const calls = message.tool_calls ?? [];
    if (!calls.length) return { reply: (message.content ?? "").trim() || "Não consegui formular uma resposta. Pode repetir de outro jeito?", steps, actions };
    messages.push({ role: "assistant", content: message.content ?? "", tool_calls: calls });
    for (const call of calls) {
      const outcome = await runTool(ctx, call.function.name, call.function.arguments);
      if ("error" in outcome) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ erro: outcome.error }) });
        continue;
      }
      steps.push(outcome.summary);
      if (outcome.actions) actions.push(...outcome.actions);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(outcome.result).slice(0, 20000) });
    }
  }
  return { reply: "Fiz várias consultas mas não cheguei a uma resposta final. Pode dividir o pedido em partes menores?", steps, actions };
}
