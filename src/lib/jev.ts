import "server-only";

/**
 * Jev, TypeSafe's decision model, reached through OpenRouter with the same
 * key the assistant already uses. It does not write text: it answers typed
 * questions about a state in a few hundred milliseconds for a fraction of a
 * cent. The assistant uses it twice per turn: to read the intent before the
 * language model runs (and to short-circuit the obvious cases), and to check
 * that an action that changes data was really asked for before it executes.
 * Every failure here degrades to "no opinion"; the assistant never depends on it.
 */

type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "noul"; instructions: string };
type Answer =
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: "noul"; noul: number };

export const jevEnabled = () => !!process.env.OPENROUTER_API_KEY && process.env.ASSISTANT_JEV !== "off";
const JEV_MODEL = process.env.ASSISTANT_JEV_MODEL || "~typesafe/jev-latest";

async function ask(state: unknown, questions: Record<string, Question>): Promise<Record<string, Answer> | null> {
  if (!jevEnabled()) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.BETTER_AUTH_URL || "https://console.anuntech.com",
        "X-Title": "Anuntech Console",
      },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal: AbortSignal.timeout(6000),
    });
    const data = (await res.json().catch(() => null)) as { answers?: Record<string, Answer>; error?: { message?: string } } | null;
    if (!res.ok || !data?.answers) {
      console.warn("[assistant] Jev unavailable", { status: res.status, detail: data?.error?.message });
      return null;
    }
    return data.answers;
  } catch (error) {
    console.warn("[assistant] Jev failed", error instanceof Error ? error.message : error);
    return null;
  }
}

/* ---------- intent, before the language model ---------- */

export const intents = {
  consultar: "Ver ou perguntar sobre dados do Console: faturas, boletos, chamados, projetos, tarefas, produtos, contratos, orçamentos, resumos e totais",
  tela: "Preencher, completar, corrigir ou enviar o formulário que já está aberto na tela agora",
  criar: "Criar ou alterar algo que não está na tela: abrir chamado, responder chamado, criar projeto, tarefa ou orçamento, mover tarefa",
  navegar: "Ir para uma tela do Console, sem pedir mais nada",
  humano: "Falar com uma pessoa de verdade da equipe da Anuntech, ou ser atendido por alguém",
  duvida: "Pergunta sobre a Anuntech, seus produtos, políticas, prazos ou como algo funciona",
  conversa: "Cumprimento, agradecimento, confirmação curta ('sim', 'ok') ou conversa sem um pedido novo",
} as const;
export type Intent = keyof typeof intents;

export type Route = {
  intent: Intent;
  confidence: number;
  /** Which screen, when the intent is to navigate. */
  destination: string | null;
  destinationConfidence: number;
};

export async function routeIntent(input: {
  message: string;
  previousAssistant: string | null;
  path: string;
  formOnScreen: boolean;
  destinations: Record<string, string>;
}): Promise<Route | null> {
  const answers = await ask(
    {
      mensagem: input.message,
      resposta_anterior_do_assistente: input.previousAssistant?.slice(0, 600) ?? null,
      tela_atual: input.path,
      ha_formulario_aberto: input.formOnScreen,
    },
    {
      intent: { type: "choice", instructions: "O que a pessoa quer que o assistente do Console faça com esta mensagem?", criteria: intents },
      destino: {
        type: "choice",
        instructions: "Se a pessoa quer ir para uma tela, qual? Escolha 'nenhuma' quando ela não pede para abrir uma tela.",
        criteria: { nenhuma: "A mensagem não pede para abrir uma tela específica", ...input.destinations },
      },
    },
  );
  const intent = answers?.intent;
  const destination = answers?.destino;
  if (!intent || intent.type !== "choice" || !(intent.choice in intents)) return null;
  return {
    intent: intent.choice as Intent,
    confidence: intent.confidence,
    destination: destination?.type === "choice" && destination.choice !== "nenhuma" ? destination.choice : null,
    destinationConfidence: destination?.type === "choice" ? destination.confidence : 0,
  };
}

/* ---------- consent, before an action runs ---------- */

/**
 * Did the person actually ask for this exact action, or approve it, in the
 * recent conversation? `null` means Jev had no say; the caller then trusts
 * the language model as before.
 */
export async function approveAction(input: {
  conversation: { role: string; content: string }[];
  tool: string;
  args: unknown;
}): Promise<{ approved: boolean; score: number } | null> {
  const answers = await ask(
    {
      conversa_recente: input.conversation.slice(-6).map((m) => ({ de: m.role === "user" ? "pessoa" : "assistente", texto: m.content.slice(0, 700) })),
      acao_que_o_assistente_quer_executar: { ferramenta: input.tool, dados: input.args },
    },
    {
      aprovado: {
        type: "noul",
        instructions:
          "A pessoa pediu explicitamente esta ação, com estes dados, ou aprovou uma proposta do assistente que descreve exatamente esta ação (respostas como 'sim', 'pode', 'aprovo', 'faça', 'confirmo' valem como aprovação). Um pedido vago, uma pergunta ou uma ação diferente da proposta não valem.",
      },
    },
  );
  const answer = answers?.aprovado;
  if (!answer || answer.type !== "noul") return null;
  return { approved: answer.noul >= 0.6, score: answer.noul };
}
