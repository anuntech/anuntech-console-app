import "server-only";
import { experimental_decide as decide, gateway } from "ai";
import { gatewayReady, PRIVATE_GATEWAY } from "../ai/gateway-env";
import { toolAreas, type ToolArea } from "./assistant-tools-kit";

/**
 * Jev, TypeSafe's decision model, reached through the AI Gateway like every
 * other AI call. It does not write text: it answers typed questions about a
 * state in a few hundred milliseconds for a fraction of a cent. The
 * assistant uses it to read the intent before the language model runs (and
 * to short-circuit the obvious cases: opening a screen, calling the team).
 * It never approves a change: every write waits for the person's click on a
 * confirmation card (assistant-proposals.ts), so Jev being off, slow or wrong
 * can only cost a shortcut, never let an action through.
 * Every failure here degrades to "no opinion".
 */

type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "boolean"; instructions: string };
/** A choice's confidence is the probability Jev gave the option it chose (0 when it sent none). */
type Answer = { type: "choice"; choice: string; confidence: number } | { type: "boolean"; probability: number };

export const jevEnabled = () => gatewayReady() && process.env.ASSISTANT_JEV !== "off";
const JEV_MODEL = process.env.ASSISTANT_JEV_MODEL || "typesafe-ai/jev";

async function ask(state: Record<string, unknown>, questions: Record<string, Question>): Promise<Record<string, Answer> | null> {
  if (!jevEnabled()) return null;
  try {
    const { answers } = await decide({
      model: gateway.decisionModel(JEV_MODEL),
      state: state as never,
      questions,
      // Private like every call, and only TypeSafe's own endpoint: another host serves the same model
      // without the zero-retention promise.
      providerOptions: { gateway: { ...PRIVATE_GATEWAY, only: ["typesafe-ai"] } },
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(6000),
    });
    const read: Record<string, Answer> = {};
    for (const [id, answer] of Object.entries(answers)) {
      if (answer.type === "choice") read[id] = { type: "choice", choice: answer.choice, confidence: answer.probabilities?.[answer.choice] ?? 0 };
      else if (answer.type === "boolean") read[id] = { type: "boolean", probability: answer.probability };
    }
    return read;
  } catch (error) {
    // Only what kind of failure: the error's cause carries the request, client text included.
    const status = (error as { statusCode?: unknown }).statusCode;
    console.warn("[assistant] Jev unavailable", { name: error instanceof Error ? error.name : "unknown", status: typeof status === "number" ? status : undefined });
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
  /** The parts of the Console this message touches; the model gets their tools. */
  areas: ToolArea[];
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
      ...Object.fromEntries(
        (Object.entries(toolAreas) as [ToolArea, string][]).map(([key, description]) => [
          `area_${key}`,
          { type: "boolean", instructions: `Para atender a mensagem (considerando a resposta anterior), o assistente precisa mexer nesta área do Console: ${description}.` },
        ]),
      ),
    },
  );
  const intent = answers?.intent;
  const destination = answers?.destino;
  if (!intent || intent.type !== "choice" || !(intent.choice in intents)) return null;
  const areas = (Object.keys(toolAreas) as ToolArea[]).filter((key) => {
    const answer = answers?.[`area_${key}`];
    return answer?.type === "boolean" && answer.probability >= 0.3;
  });
  return {
    intent: intent.choice as Intent,
    confidence: intent.confidence,
    areas,
    destination: destination?.type === "choice" && destination.choice !== "nenhuma" ? destination.choice : null,
    destinationConfidence: destination?.type === "choice" ? destination.confidence : 0,
  };
}

/* ---------- a new ticket, read by its text ---------- */

/**
 * What the ticket's text says it is, regardless of what was ticked when it
 * was opened: the kind and, for something that broke, how badly. Null when
 * Jev had no say.
 */
export async function classifyTicket(input: { subject: string; body: string; kinds: Record<string, string>; impacts: Record<string, string> }) {
  const answers = await ask(
    { assunto: input.subject.slice(0, 200), descricao: input.body.slice(0, 2000) },
    {
      tipo: { type: "choice", instructions: "Pelo texto, o que é este chamado de suporte?", criteria: input.kinds },
      impacto: {
        type: "choice",
        instructions: "Se algo parou ou deu erro, quanto isso atrapalha o cliente agora, pelo que o texto diz? Se não é um erro, escolha 'other'.",
        criteria: input.impacts,
      },
    },
  );
  const kind = answers?.tipo;
  const impact = answers?.impacto;
  if (kind?.type !== "choice" || impact?.type !== "choice") return null;
  return { kind: kind.choice, kindConfidence: kind.confidence, impact: impact.choice, impactConfidence: impact.confidence };
}
