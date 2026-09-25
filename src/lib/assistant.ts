import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import type { Actor } from "./access";
import { assistantDocuments, assistantSettings } from "@/db/schema";
import { saoPauloDate } from "./dates";
import { longDateLabel } from "./format";
import { hasPermission } from "./permissions";
import { runTool, toolCatalog, type ClientAction } from "./assistant-tools";
import { modelSupportsReasoning } from "./openrouter-models";

export const DEFAULT_ASSISTANT_MODEL = "anthropic/claude-sonnet-5";
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
    "- As ferramentas de listagem aceitam companyId opcional: sem ele, trazem todas as empresas que a pessoa vê em uma única chamada. Prefira isso a chamar uma vez por empresa.",
    "- Listagens trazem só as primeiras linhas (limite padrão 5, máximo 50) e não servem para somar. Para totais, rankings, 'maior cliente', 'quanto faturamos' ou 'quem deve mais', use resumo_financeiro e cite o período usado.",
    "- Antes de ações que criam ou alteram algo (abrir_chamado, responder_chamado, criar_tarefa, mover_tarefa, criar_projeto), confirme o conteúdo com a pessoa, a não ser que o pedido já esteja completo e inequívoco. Depois de executar, diga o que foi feito com o link.",
    "- Cobranças, orçamentos, contratos e cadastros de empresa não são criados por você: leve a pessoa à tela com abrir_tela. Nunca diga que uma fatura foi paga se a situação não disser isso.",
    "- Se a pessoa quiser falar com alguém, ou se você não conseguir ajudar, use abrir_chat_suporte e diga que a equipe responde por ali.",
    "- Dúvidas sobre a Anuntech: responda com a base de conhecimento abaixo (ou buscar_conhecimento). Se não estiver lá, diga que não sabe e ofereça o chat com a equipe.",
    "- Valores em reais no formato R$ 1.234,56 e datas como 24/09/2026.",
    actor.admin
      ? "- Para a equipe da Anuntech, consultas sem empresa definida valem para todas as empresas: chame a ferramenta sem companyId em vez de perguntar qual. Você também organiza trabalho: pode montar um projeto inteiro (criar_projeto e depois uma criar_tarefa por tarefa, com prioridade, prazo e estimativa) a partir de uma descrição, e responder chamados em nome da equipe. Apresente o plano de tarefas antes de criar e execute quando a pessoa aprovar."
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

/** Providers differ on the shape of `content`; this flattens it to text. */
const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text ?? "") : "")).join("")
      : "";

type Completion = { content: string; toolCalls: ToolCall[]; finishReason: string | null };

async function complete(
  model: string,
  messages: Message[],
  tools: ReturnType<typeof toolCatalog>,
  options: { maxTokens: number; reasoning: boolean; attempt?: number },
): Promise<Completion> {
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
      max_tokens: options.maxTokens,
      // Thinking models spend the output budget on reasoning first; keep it short so text remains.
      ...(options.reasoning ? { reasoning: { effort: "low" } } : {}),
    }),
    signal: AbortSignal.timeout(90000),
  });
  const data = (await res.json().catch(() => null)) as
    | {
        choices?: { message: { content?: unknown; tool_calls?: ToolCall[] }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        error?: { message?: string };
      }
    | null;
  if (!res.ok || !data?.choices?.length) {
    const detail = data?.error?.message ?? `HTTP ${res.status}`;
    console.warn("[assistant] OpenRouter refused", { model, status: res.status, detail, maxTokens: options.maxTokens });
    if (res.status === 401) throw new AssistantError("A chave do OpenRouter foi recusada. Confira em Configurações › Assistente.");
    if ((res.status === 429 || res.status >= 500) && !(options.attempt ?? 0)) {
      // Free and busy models hiccup; one short pause usually clears it.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return complete(model, messages, tools, { ...options, attempt: 1 });
    }
    if (res.status === 429)
      throw new AssistantError("O modelo está no limite de uso do OpenRouter agora (comum nos modelos gratuitos). Tente de novo em instantes ou escolha outro modelo em Configurações › Assistente.");
    if (res.status === 402) {
      // "You requested up to 4000 tokens, but can only afford 3372": shrink the budget once and go on.
      const affordable = Number(/afford (\d+)/.exec(detail)?.[1]);
      if (affordable >= 600 && affordable < options.maxTokens) return complete(model, messages, tools, { ...options, maxTokens: affordable - 50 });
      throw new AssistantError("A conta do OpenRouter está sem créditos. Adicione créditos em openrouter.ai/settings/credits para o assistente voltar.");
    }
    if (res.status === 404 || /model/i.test(detail)) throw new AssistantError(`O modelo "${model}" não foi aceito pelo OpenRouter: ${detail}`);
    throw new AssistantError(`O OpenRouter não respondeu (${detail}). Tente de novo em instantes.`);
  }
  const choice = data.choices[0];
  const completion = { content: textOf(choice.message.content).trim(), toolCalls: choice.message.tool_calls ?? [], finishReason: choice.finish_reason ?? null };
  if (!completion.content && !completion.toolCalls.length)
    console.warn("[assistant] empty reply", { model, finishReason: completion.finishReason, usage: data.usage, maxTokens: options.maxTokens });
  return completion;
}

/**
 * One turn of the conversation: the model answers, calling tools as many
 * times as it needs (bounded), every tool running with the caller's own
 * permissions. Returns the final text plus what was done along the way.
 */
export async function converse(actor: Actor, history: ChatTurn[]): Promise<AssistantReply> {
  const config = await assistantConfig();
  const tools = toolCatalog(actor);
  const [prompt, reasoning] = await Promise.all([systemPrompt(actor, config.prompt), modelSupportsReasoning(config.model)]);
  const messages: Message[] = [{ role: "system", content: prompt }, ...trimHistory(history)];
  const noted = new Map<string, number>();
  const actions: ClientAction[] = [];
  const ctx = { actor, today: saoPauloDate() };
  let retried = false;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const turn = await complete(config.model, messages, tools, { maxTokens: retried ? 6000 : 3000, reasoning });
    if (!turn.toolCalls.length) {
      if (turn.content) return { reply: turn.content, steps: collapse(noted), actions };
      if (!retried) {
        // Nothing came back (usually the budget went to reasoning): ask once more, plainly.
        retried = true;
        messages.push({ role: "system", content: "Escreva agora a resposta final em texto, em português, usando o que as ferramentas devolveram. Não chame mais ferramentas." });
        continue;
      }
      return { reply: "Não consegui formular uma resposta. Pode repetir de outro jeito?", steps: collapse(noted), actions };
    }
    messages.push({ role: "assistant", content: turn.content, tool_calls: turn.toolCalls });
    for (const call of turn.toolCalls) {
      const outcome = await runTool(ctx, call.function.name, call.function.arguments);
      if ("error" in outcome) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ erro: outcome.error }) });
        continue;
      }
      noted.set(outcome.summary, (noted.get(outcome.summary) ?? 0) + 1);
      if (outcome.actions) actions.push(...outcome.actions);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(outcome.result).slice(0, 20000) });
    }
  }
  return { reply: "Fiz várias consultas mas não cheguei a uma resposta final. Pode dividir o pedido em partes menores?", steps: collapse(noted), actions };
}

/** "Consultei as faturas ×7" instead of seven identical chips. */
const collapse = (noted: Map<string, number>) => [...noted].map(([summary, n]) => (n > 1 ? `${summary} ×${n}` : summary));
