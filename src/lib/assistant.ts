import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import type { Actor } from "./access";
import { assistantDocuments, assistantSettings } from "@/db/schema";
import { saoPauloDate } from "./dates";
import { longDateLabel } from "./format";
import { hasPermission } from "./permissions";
import { destinations, runTool, screenFor, toolCatalog, writeToolNames, type ClientAction, type Destination, type ToolArea } from "./assistant-tools";
import { approveAction, intents, jevEnabled, routeIntent } from "./jev";
import { plainApproval } from "./assistant-consent";
import { modelSupportsReasoning } from "./openrouter-models";
import { describePage, type PageSnapshot, areaOfPath } from "./page-snapshot";

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

export async function systemPrompt(actor: Actor, custom: string, page?: PageSnapshot) {
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
    "- Use as ferramentas para consultar e agir; nunca invente dados, valores, situações de pagamento ou links.",
    "- Se uma ferramenta devolver 'Dados inválidos', corrija os campos indicados e chame de novo (até duas tentativas) antes de desistir; não repasse o erro técnico à pessoa. Se ainda assim não der, explique em uma frase o que faltou.",
    "- Quando a 'Tela atual' indicar um 'Registro aberto', ele é o assunto: leia e altere com as ferramentas usando esse id, sem perguntar qual é. O que não for campo de formulário (fases, tarefas, horas e entrada de um orçamento) se altera pela ferramenta, nunca com preencher_tela; depois diga o que mudou, a tela se atualiza sozinha.",
    "- Nunca peça à pessoa para preencher na tela o que você mesmo pode criar com uma ferramenta, e nunca cite campos que não aparecem em 'Tela atual'. Um orçamento completo (fases, horas, taxa, entrada) se cria com criar_orcamento; a tela de novo orçamento só tem empresa, título e validade.",
    "- Investigue antes de perguntar. Quando a pessoa cita um cliente, orçamento, projeto, chamado ou contrato pelo nome, procure você mesmo (listar_empresas com busca, listar_orcamentos e ler_orcamento, listar_projetos_e_produtos e listar_tarefas, listar_chamados e ler_chamado, listar_contratos e ler_contrato) e só pergunte o que não conseguiu descobrir. Consultas são livres: encadeie quantas precisar, sem pedir permissão.",
    "- 'Igual ao X' significa ler X com a ferramenta de leitura e reproduzir; para orçamentos, criar_orcamento aceita copiarDeOrcamentoId. Nunca diga que não tem como ver algo sem antes ter tentado a ferramenta correspondente; se realmente não existir ferramenta, diga o que consegue fazer em vez disso.",
    "- Links: use caminhos relativos do Console em Markdown, como [ver fatura](/financeiro/abc). O painel transforma em links reais. Para PDF de boleto use o link boletoPdf; para pagar use linkPagamento.",
    "- Quando a pessoa tem uma única empresa, não pergunte qual; use o companyId dela. Com várias, pergunte ou use listar_empresas.",
    "- As ferramentas de listagem aceitam companyId opcional: sem ele, trazem todas as empresas que a pessoa vê em uma única chamada. Prefira isso a chamar uma vez por empresa.",
    "- Listagens trazem só as primeiras linhas (limite padrão 5, máximo 50) e não servem para somar. Para totais, rankings, 'maior cliente', 'quanto faturamos' ou 'quem deve mais', use resumo_financeiro e cite o período usado.",
    "- Antes de ações que criam ou alteram algo (abrir_chamado, responder_chamado, criar_tarefa, mover_tarefa, criar_projeto), confirme o conteúdo com a pessoa, a não ser que o pedido já esteja completo e inequívoco. Depois de executar, diga o que foi feito com o link.",
    "- Cobranças, contratos e cadastros de empresa não são criados por você: leve a pessoa à tela com abrir_tela. Nunca diga que uma fatura foi paga se a situação não disser isso.",
    "- Pedidos sobre 'todos' ou 'todas' são ações em lote: leia a lista e aplique de uma vez (atualizar_tarefa aceita tarefaIds; em responsaveis, 'eu' é a própria pessoa). Nunca diga que não existe ação em massa.",
    "- Quando precisar de dados da pessoa, peça só o obrigatório, em uma frase (por exemplo: 'me passe os títulos, um por linha'); o resto assume padrões e pode ser ajustado depois.",
    actor.admin
      ? "- Quem fala com você é da equipe da Anuntech: não ofereça nem abra chat de suporte para ela. O que não der para fazer, diga em uma frase e aponte a tela."
      : "- Só use abrir_chat_suporte quando a pessoa pedir para falar com alguém. Nunca abra o chat como saída para uma ação que você não conseguiu fazer: diga o que não dá e aponte a tela onde ela faz.",
    "- Você enxerga o formulário da tela em que a pessoa está (seção 'Tela atual'). Se ela pedir para preencher, completar ou ajustar a tela, use preencher_tela com os nomes exatos dos campos e valores no formato indicado; use clicar_na_tela para acionar botões. Só envie o formulário quando ela pedir para salvar/enviar. Prefira preencher a tela quando ela já está aberta; use as ferramentas de criação quando não está.",
    actor.admin
      ? "- Dúvidas sobre a Anuntech: responda com a base de conhecimento abaixo (ou buscar_conhecimento). Se não estiver lá, diga que não sabe."
      : "- Dúvidas sobre a Anuntech: responda com a base de conhecimento abaixo (ou buscar_conhecimento). Se não estiver lá, diga que não sabe e ofereça o chat com a equipe.",
    "- Valores em reais no formato R$ 1.234,56 e datas como 24/09/2026.",
    actor.admin
      ? "- Para a equipe da Anuntech, consultas sem empresa definida valem para todas as empresas: chame a ferramenta sem companyId em vez de perguntar qual. Você também organiza trabalho: pode montar um projeto inteiro (criar_projeto e depois uma criar_tarefa por tarefa, com prioridade, prazo, estimativa e responsáveis) a partir de uma descrição, alterar tarefas em lote com atualizar_tarefa, criar orçamentos em rascunho com criar_orcamento (fases com horas, tarefas, taxa/hora, entrada e validade; o envio ao cliente é na tela) e responder chamados em nome da equipe. Apresente o plano antes de criar e execute quando a pessoa aprovar."
      : "",
    "",
    "Base de conhecimento da Anuntech:",
    await knowledge(),
    custom.trim() ? `\nInstruções da Anuntech:\n${custom.trim()}` : "",
    page ? `\n${describePage(page)}` : "",
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
export async function converse(actor: Actor, history: ChatTurn[], page?: PageSnapshot): Promise<AssistantReply> {
  const config = await assistantConfig();
  let tools = toolCatalog(actor);
  const [prompt, reasoning] = await Promise.all([systemPrompt(actor, config.prompt, page), modelSupportsReasoning(config.model)]);
  const turns = trimHistory(history);
  const messages: Message[] = [{ role: "system", content: prompt }, ...turns];
  const noted = new Map<string, number>();
  const actions: ClientAction[] = [];
  const ctx = { actor, today: saoPauloDate() };
  let retried = false;
  // A write changes what the open screen shows; the panel reloads the page's data after the reply.
  let wrote = false;
  // A plain "sim" to the assistant's question is consent; a tool approved once in this
  // turn isn't asked about again for each of its calls (32 tasks, 32 calls).
  const consented = new Set<string>(plainApproval(turns) ? writeToolNames : []);
  const done = (reply: string) => ({
    reply,
    steps: collapse(noted),
    actions: wrote && !actions.some((a) => a.type === "navigate") ? [...actions, { type: "refresh" as const }] : actions,
  });

  // Jev reads the intent first: the obvious cases end here, the rest reaches the model with a hint.
  if (jevEnabled() && turns.length) {
    const last = turns[turns.length - 1].content;
    const previousAssistant = [...turns].reverse().find((t) => t.role === "assistant")?.content ?? null;
    const allowed = Object.fromEntries(
      (Object.entries(destinations) as [Destination, { label: string; staff?: boolean }][])
        .filter(([, d]) => !d.staff || actor.admin)
        .map(([key, d]) => [key, d.label]),
    );
    const route = await routeIntent({ message: last, previousAssistant, path: page?.path ?? "", formOnScreen: !!page?.forms.length, destinations: allowed });
    if (route) {
      if (route.intent === "humano" && route.confidence >= 0.9 && !actor.admin)
        return { reply: "Abrindo o chat com a equipe da Anuntech. Eles respondem por ali.", steps: ["Jev: você quer falar com a equipe"], actions: [{ type: "open_support" }] };
      if (route.intent === "navegar" && route.destination && route.destinationConfidence >= 0.9) {
        try {
          const screen = screenFor(actor, route.destination as Destination);
          return { reply: `Abrindo ${screen.label}.`, steps: [`Jev: abrir ${screen.label}`], actions: [{ type: "navigate", href: screen.href }] };
        } catch {
          /* not allowed for this person: let the model explain */
        }
      }
      messages[0].content += `\n\nLeitura rápida da intenção (Jev, ${Math.round(route.confidence * 100)}%): ${route.intent} — ${intents[route.intent]}.`;
      // Only the tools of the areas this message touches travel to the model; listings and navigation always do.
      // When Jev sees a request for data or an action but no clear area, the model keeps the whole catalog.
      const areas = new Set(route.areas);
      if (page?.forms.length && (route.intent === "tela" || route.intent === "criar")) areas.add("tela");
      // The section on screen is always in play: "preencha as tarefas" on a quote draft is about the quote.
      const onScreen = page ? areaOfPath(page.path) : null;
      if (onScreen && areas.size) areas.add(onScreen as ToolArea);
      const unsure = !areas.size && (route.intent === "consultar" || route.intent === "criar" || route.intent === "tela");
      if (!unsure) {
        const subset = toolCatalog(actor, areas);
        console.info("[assistant] tools", { sent: subset.length, of: tools.length, areas: [...areas] });
        tools = subset;
      }
    }
  }
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const turn = await complete(config.model, messages, tools, { maxTokens: retried ? 6000 : 3000, reasoning });
    if (!turn.toolCalls.length) {
      if (turn.content) return done(turn.content);
      if (!retried) {
        // Nothing came back (usually the budget went to reasoning): ask once more, plainly.
        retried = true;
        messages.push({ role: "system", content: "Escreva agora a resposta final em texto, em português, usando o que as ferramentas devolveram. Não chame mais ferramentas." });
        continue;
      }
      return done("Não consegui formular uma resposta. Pode repetir de outro jeito?");
    }
    messages.push({ role: "assistant", content: turn.content, tool_calls: turn.toolCalls });
    for (const call of turn.toolCalls) {
      if (
        jevEnabled() &&
        writeToolNames.has(call.function.name) &&
        !consented.has(call.function.name) &&
        needsConsent(call.function.name, call.function.arguments)
      ) {
        // A second opinion before anything changes: was this exact action asked for or approved?
        const verdict = await approveAction({ conversation: turns, tool: call.function.name, args: parseArgs(call.function.arguments) });
        console.info("[assistant] consent", { tool: call.function.name, approved: verdict?.approved ?? null, score: verdict?.score ?? null });
        if (verdict?.approved) consented.add(call.function.name);
        if (verdict && !verdict.approved) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ erro: "Ação ainda não confirmada pela pessoa (checagem automática). Descreva exatamente o que vai fazer, com os dados, e peça um 'sim' antes de executar." }),
          });
          noted.set("Pedi confirmação antes de agir", 1);
          continue;
        }
      }
      const outcome = await runTool(ctx, call.function.name, call.function.arguments);
      if ("error" in outcome) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ erro: outcome.error }) });
        continue;
      }
      noted.set(outcome.summary, (noted.get(outcome.summary) ?? 0) + 1);
      if (writeToolNames.has(call.function.name) && !outcome.actions?.length) wrote = true;
      if (outcome.actions) actions.push(...outcome.actions);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(outcome.result).slice(0, 20000) });
    }
  }
  return done("Fiz várias consultas mas não cheguei a uma resposta final. Pode dividir o pedido em partes menores?");
}

const parseArgs = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};
/** Filling a form is harmless until it is submitted; everything else that writes gets checked. */
const needsConsent = (tool: string, raw: string) => {
  if (tool !== "preencher_tela") return true;
  const args = parseArgs(raw) as { enviar?: boolean } | null;
  return !!args && typeof args === "object" && args.enviar === true;
};

/** "Consultei as faturas ×7" instead of seven identical chips. */
const collapse = (noted: Map<string, number>) => [...noted].map(([summary, n]) => (n > 1 ? `${summary} ×${n}` : summary));
