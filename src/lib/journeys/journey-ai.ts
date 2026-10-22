import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { assistantDocuments, journeys, quotes, tasks } from "@/db/schema";
import { db } from "../db";
import { AssistantError } from "../assistant/assistant";
import { oneShot } from "../assistant/one-shot";
import { contractStatusLabels, type ContractStatus } from "../contracts/contract-table";
import { dateLabel } from "../format";
import { saoPauloDate } from "../dates";
import { hoursLabel, quoteStatusLabels, weeksLabel, type QuoteContent } from "../quotes/quote-model";
import { journeyFacts, journeyRows, readBriefing, type JourneyRow } from "./journey-facts";
import {
  JOURNEY_STAGES,
  JOURNEY_TEMPLATE,
  designDirectionSchema,
  isExtraKey,
  journeyBriefingSchema,
  journeyStageKeys,
  journeyStatusLabels,
  meetingTitles,
  projectTypeLabels,
  resolveJourney,
  stageTitle,
  templateStep,
  type DesignDirection,
  type JourneyBriefing,
  type JourneyFacts,
  type JourneyMeeting,
  type JourneyStage,
  type ResolvedJourney,
  type ResolvedStep,
  type StepStatus,
  type StoredStep,
} from "./journey-model";

/*
 * The AI of the "Jornada do projeto": drafts the team reads, edits and keeps
 * (or not). Each helper reads the journey as the Console knows it, asks the
 * team's model once and returns text or a checked object; nothing is saved
 * here. Prompts carry names only (never e-mail, phone or document numbers),
 * free text is scrubbed of contacts and secrets before it leaves, and the
 * call asks for providers that do not keep the data (one-shot.ts).
 */

/* ---------- limits ---------- */

const CONTEXT_CHARS = 12000;
const QUOTE_CHARS = 6000;
const BRIEFING_CHARS = 3000;
const NOTES_CHARS = 16000;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/**
 * What leaves for the model never carries contacts or secrets, even when
 * someone pasted them into notes or feedback: connection strings, API keys,
 * "SENHA: …", e-mails, CPF/CNPJ and phone numbers become placeholders.
 */
const SCRUBS: [RegExp, string][] = [
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@\S+/gi, "[conexão removida]"],
  [/\b(?:sk-|sk_|pk_|rk_|ghp_|gho_|ghs_|github_pat_|xox[abpr]-|re_|whsec_|npm_|napi_)[A-Za-z0-9_-]{16,}/g, "[chave removida]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[chave removida]"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, "[chave removida]"],
  [/\beyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g, "[token removido]"],
  // NAME=value assignments only: "RESEND_API_KEY: chave do Resend" is a description and stays.
  [/\b([A-Z][A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|PASS)[A-Z0-9_]*)\s*=\s*(?![<[])\S+/g, "$1=[valor removido]"],
  // "senha: X9!k…" goes; "senha: fica no cofre" is prose and stays.
  [/\b(senha|password|pwd)\b([^\n:=]{0,30}?[:=]\s*|[^\n]{0,30}?\s(?:é|e)\s+|\s+)(?=\S*[\d!@#$%^&*])\S+/gi, "$1$2[removida]"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]"],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[documento]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento]"],
  [/\+?\b55\d{10,11}\b/g, "[telefone]"],
  [/(?:\+?55[\s-]?)?(?:\(\d{2}\)\s?|\b\d{2}[\s-])9?\d{4}[\s-]?\d{4}\b/g, "[telefone]"],
];
export const scrub = (text: string) => SCRUBS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);

/** Shared by every prompt: the voice, no invented facts, no secrets, no contacts. */
const RULES = [
  "Regras:",
  "- Português do Brasil, na voz da Anuntech: trate por você, frases curtas e diretas, verbos ativos. Sem ponto de exclamação, sem travessão ligando frases (use ponto, vírgula ou dois-pontos), sem abertura e sem fecho.",
  "- Use só o que está no contexto. Nunca invente fatos, nomes, valores, prazos, integrações ou decisões do cliente. O que não se sabe vira pergunta.",
  "- Nunca escreva senhas, chaves de API, tokens, connection strings ou valores de variáveis de ambiente, nem como exemplo. Use marcadores como <valor> e diga onde o valor fica (variáveis da Vercel ou cofre de senhas da equipe).",
  "- Não escreva e-mail, telefone, CPF ou CNPJ de ninguém. Pessoas e empresas só pelo nome.",
].join("\n");

const system = (...lines: string[]) => [lines[0], RULES, ...lines.slice(1)].join("\n");

/* ---------- context ---------- */

const STATUS_LABELS: Record<StepStatus, string> = {
  done: "feito",
  doing: "em andamento",
  ready: "a fazer",
  waiting: "esperando outro passo",
  skipped: "não se aplica",
};

export type JourneyContext = {
  journey: JourneyRow;
  facts: JourneyFacts;
  rows: StoredStep[];
  briefing: JourneyBriefing | null;
  resolved: ResolvedJourney;
  /** The proposal's content (the version sent, else the draft): summary, stack and phases. */
  quote: Pick<QuoteContent, "summary" | "stack" | "phases"> | null;
  /** Name only: the company's, or the lead's while there is no company. */
  client: string;
  /** Everything above as prompt text, under ~12 thousand characters. */
  text: string;
};

function briefingText(b: JourneyBriefing) {
  const list = (label: string, items: string[]) => (items.length ? `${label}:\n${items.map((item) => `- ${item}`).join("\n")}` : "");
  const parts = [
    b.tipoProjeto && `Tipo: ${projectTypeLabels[b.tipoProjeto]}`,
    b.objetivo && `Objetivo: ${b.objetivo}`,
    b.problema && `Problema: ${b.problema}`,
    b.publico && `Público: ${b.publico}`,
    list("Funcionalidades", b.funcionalidades),
    list("Integrações", b.integracoes),
    list("Restrições", b.restricoes),
    b.prazoDesejado && `Prazo desejado: ${b.prazoDesejado}`,
    b.orcamentoCliente && `Verba do cliente: ${b.orcamentoCliente}`,
    b.decisor && `Quem decide: ${b.decisor}`,
    list("Perguntas em aberto", b.perguntasAbertas),
    list("Riscos", b.riscos),
    list("Próximos passos", b.proximosPassos),
  ].filter(Boolean) as string[];
  const structured = parts.join("\n");
  const room = BRIEFING_CHARS - structured.length - 40;
  const notes = b.notas.trim() && room > 300 ? `\nTrecho das notas da reunião:\n${clip(b.notas.trim(), Math.min(room, 1500))}` : "";
  return clip(`${structured}${notes}`, BRIEFING_CHARS);
}

function quoteText(content: Pick<QuoteContent, "summary" | "stack" | "phases">, label: string) {
  const lines = [label];
  if (content.summary.trim()) lines.push(`Resumo: ${clip(content.summary.trim(), 1500)}`);
  if (content.stack.length) lines.push(`Stack: ${content.stack.join(", ")}`);
  if (content.phases.length) lines.push("Fases:");
  content.phases.forEach((phase, index) => {
    const span = [hoursLabel(phase.hoursMin, phase.hoursMax), weeksLabel(phase.weeks)].filter(Boolean).join(", ");
    lines.push(`${index + 1}. ${phase.name} (${span})${phase.description.trim() ? `: ${clip(phase.description.trim(), 200)}` : ""}`);
    for (const task of phase.tasks) lines.push(`   - ${task.title}${task.description.trim() ? `: ${clip(task.description.trim(), 120)}` : ""}`);
  });
  let text = "";
  for (const line of lines) {
    if (text.length + line.length + 1 > QUOTE_CHARS - 30) return `${text}(o resto do orçamento foi cortado)`;
    text += `${line}\n`;
  }
  return text.trimEnd();
}

function stepsText(resolved: ResolvedJourney) {
  return resolved.stages
    .map((stage) => {
      const steps = [...stage.steps, ...stage.optional].map((s) => {
        const tags = [s.def.required ? null : "opcional", s.extra ? "acrescentado pela equipe" : null].filter(Boolean).join(", ");
        const detail = s.detail && s.status !== "waiting" ? ` (${clip(s.detail, 100)})` : "";
        return `- ${s.def.title}${tags ? ` [${tags}]` : ""}: ${STATUS_LABELS[s.status]}${detail}`;
      });
      return `### ${stage.title}\n${steps.join("\n")}`;
    })
    .join("\n");
}

/**
 * The journey as the model reads it: the client (by name), what the Console
 * knows, the saved briefing, the steps with their status and the proposal's
 * phases. `withBriefing: false` leaves the saved briefing out (the briefing
 * draft starts from the new notes).
 */
export async function journeyContext(journeyId: string, options: { withBriefing?: boolean } = {}): Promise<JourneyContext> {
  const [journey] = await db.select().from(journeys).where(eq(journeys.id, journeyId));
  if (!journey) throw new AssistantError("Jornada não encontrada.");
  const [facts, rows, quoteRow] = await Promise.all([
    journeyFacts(journey),
    journeyRows(journey.id),
    journey.quoteId
      ? db
          .select({ status: quotes.status, content: quotes.content, publication: quotes.publication })
          .from(quotes)
          .where(eq(quotes.id, journey.quoteId))
          .then((found) => found[0] ?? null)
      : null,
  ]);
  const briefing = readBriefing(journey.briefing);
  const resolved = resolveJourney(facts, rows, briefing, { id: journey.id, ticketId: journey.ticketId });
  // A proposal taken back to draft keeps its old publication: the draft being edited is what counts.
  const sent = !!quoteRow && quoteRow.status !== "draft" && !!quoteRow.publication;
  const source = quoteRow ? (sent ? quoteRow.publication! : quoteRow.content) : null;
  // Only these three fields: the publication also names the company's document, which never goes out.
  const quote = source ? { summary: source.summary ?? "", stack: source.stack ?? [], phases: source.phases ?? [] } : null;
  const client = facts.company?.name ?? journey.lead?.name?.trim() ?? "cliente ainda sem nome";

  const f = facts;
  const header = [
    `Projeto: ${journey.title}`,
    `Hoje: ${dateLabel(saoPauloDate())}`,
    `Jornada: ${journeyStatusLabels[journey.status]}, aberta em ${dateLabel(journey.createdAt)}`,
    `Cliente: ${client} (${f.company ? "empresa cadastrada no Console" : "ainda sem cadastro no Console"})`,
    f.ticket && `Pedido no Console: "${clip(f.ticket.subject, 160)}"`,
    f.quote &&
      `Orçamento ${f.quote.number}: ${f.quote.title} (${quoteStatusLabels[f.quote.status]}; ${f.quote.phases} fases, ${f.quote.tasks} tarefas${f.quote.validUntil ? `; válido até ${dateLabel(f.quote.validUntil)}` : ""})`,
    f.contract && `Contrato: ${f.contract.title} (${contractStatusLabels[f.contract.status as ContractStatus] ?? f.contract.status})`,
    f.project &&
      `Projeto no quadro: ${f.project.name} (${f.project.done} de ${f.project.total} cartões concluídos${f.project.review ? `, ${f.project.review} em Revisão` : ""})`,
    f.project?.url && `Endereço de produção: ${f.project.url}`,
    f.hosting && `Hospedagem: ${f.hosting.name}`,
    `Progresso da jornada: ${resolved.done} de ${resolved.total} passos${resolved.next ? `; próximo: ${resolved.next.def.title}` : ""}`,
  ].filter(Boolean) as string[];

  const sections = [
    header.join("\n"),
    options.withBriefing === false ? null : briefing ? `Briefing salvo:\n${briefingText(briefing)}` : "Briefing salvo: nenhum ainda.",
    `Passos da jornada (situação de cada um):\n${stepsText(resolved)}`,
    quote ? quoteText(quote, `Conteúdo do orçamento${f.quote ? ` ${f.quote.number}` : ""} (${sent ? "versão enviada ao cliente" : "rascunho"}):`) : "Orçamento: nenhum vinculado ainda.",
  ].filter(Boolean) as string[];

  return { journey, facts, rows, briefing, resolved, quote, client, text: scrub(clip(sections.join("\n\n"), CONTEXT_CHARS)) };
}

/** The one place prompts leave: user text scrubbed, the journey's model, no training on the data. */
function ask(options: { system: string; user: string; maxTokens: number; temperature: number; timeoutMs: number; signal?: AbortSignal }): Promise<string>;
function ask<T>(options: { system: string; user: string; maxTokens: number; temperature: number; timeoutMs: number; signal?: AbortSignal; schema: z.ZodType<T> }): Promise<T>;
function ask<T>(options: { system: string; user: string; maxTokens: number; temperature: number; timeoutMs: number; signal?: AbortSignal; schema?: z.ZodType<T> }) {
  const user = scrub(options.user);
  return options.schema ? oneShot({ ...options, user, schema: options.schema }) : oneShot({ ...options, user, schema: undefined });
}

/* ---------- briefing ---------- */

const BRIEFING_PROMPT = system(
  "Você organiza o briefing de um projeto de software da Anuntech a partir das notas da reunião com o cliente e, quando houver, da transcrição.",
  "- Preencha cada campo só com o que as notas ou a transcrição dizem. Sem informação, o campo fica vazio (\"\" ou []).",
  "- objetivo: o que o cliente quer alcançar, em uma ou duas frases. problema: o que acontece hoje e incomoda. publico: quem vai usar.",
  "- tipoProjeto: \"site\", \"app\", \"sistema\", \"automacao\", \"integracao\" ou \"outro\"; null quando não der para saber.",
  "- funcionalidades: uma por item, curtas, nas palavras do cliente. integracoes: sistemas e serviços com que o projeto precisa conversar. restricoes: limites técnicos ou legais que foram ditos (verba só em orcamentoCliente, nunca aqui).",
  "- prazoDesejado, orcamentoCliente e decisor: como foram ditos. decisor só com nome e papel.",
  "- perguntasAbertas: o que ficou em aberto, o que é ambíguo e o que falta para orçar. Quando algo importante não foi dito, escreva a pergunta aqui.",
  "- riscos: o que pode atrasar ou encarecer, só quando as notas dão motivo. proximosPassos: o que foi combinado para depois da reunião.",
  "- Limites: objetivo e problema até 600 caracteres, publico até 400, cada item de lista até 200 (perguntas e riscos até 300).",
  "Responda só com JSON, sem texto antes ou depois:",
  '{"objetivo":"","problema":"","publico":"","tipoProjeto":null,"funcionalidades":[],"integracoes":[],"restricoes":[],"prazoDesejado":"","orcamentoCliente":"","decisor":"","perguntasAbertas":[],"riscos":[],"proximosPassos":[]}',
);

const briefingAnswer = journeyBriefingSchema.omit({ notas: true });

/** The meeting's notes (and transcription) organized as the journey's briefing; `notas` keeps the notes as given. */
export async function draftJourneyBriefing(
  journeyId: string,
  input: { notas: string; transcricao?: string },
  signal?: AbortSignal,
): Promise<JourneyBriefing> {
  const notas = input.notas.trim().slice(0, NOTES_CHARS);
  if (!notas) throw new AssistantError("Escreva ou dite as notas da reunião antes.");
  const transcricao = input.transcricao?.trim().slice(0, NOTES_CHARS) ?? "";
  const context = await journeyContext(journeyId, { withBriefing: false });
  const drafted = await ask({
    system: BRIEFING_PROMPT,
    user: [context.text, `Notas da reunião:\n${notas}`, transcricao ? `Transcrição da reunião:\n${transcricao}` : null].filter(Boolean).join("\n\n"),
    maxTokens: 2000,
    temperature: 0.2,
    timeoutMs: 55000,
    signal,
    schema: briefingAnswer,
  });
  return journeyBriefingSchema.parse({ ...drafted, notas });
}

/* ---------- project prompt ---------- */

const STANDARD_TITLE = "Padrão de projeto Anuntech";

/** Used when the knowledge base has no "Padrão de projeto Anuntech" document. */
export const DEFAULT_PROJECT_STANDARD = [
  "- Next.js 16 com App Router. Antes de usar uma API do Next, ler o guia em node_modules/next/dist/docs/: esta versão muda convenções.",
  "- React 19 e TypeScript em modo strict. npm como gerenciador de pacotes.",
  "- Tailwind CSS v4 com shadcn/ui; cores, raio e fontes como variáveis CSS.",
  "- Drizzle ORM com Postgres na Neon: um projeto Neon por cliente, com branch de preview para a Vercel. Migrações versionadas no repositório.",
  "- Better Auth para login e sessões.",
  "- Resend para e-mail, com o domínio do cliente verificado (SPF, DKIM e DMARC).",
  "- zod para validar toda entrada no servidor. Autorização conferida no servidor em toda operação.",
  "- Hospedagem na Vercel, no time anuntech: produção na branch main e preview a cada pull request.",
  "- DNS na Cloudflare apontando para a Vercel.",
  "- Repositório privado na organização anuntech no GitHub.",
  "- Textos da interface em português do Brasil, datas no fuso de São Paulo, valores em reais.",
  "- Segredos só em variáveis de ambiente do servidor, nunca com prefixo NEXT_PUBLIC_ e nunca no repositório; .env.example só com os nomes.",
  "- AGENTS.md na raiz e documentação em docs/: prd.md (produto), architecture.md (onde fica cada coisa), rules.md (regras de trabalho), design.md (visual e escrita), memory.md (decisões) e task.md (pendências). O AGENTS.md manda ler o que se aplica antes de mudar algo e atualizar o que mudou ao terminar.",
].join("\n");

const PROMPT_PROMPT = system(
  "Você escreve o prompt de início do projeto: o texto que a equipe da Anuntech cola no Claude Code (ou em outro agente de código) para criar o repositório de um projeto novo de um cliente.",
  "- Escreva dirigido ao agente de código, no imperativo (\"Crie\", \"Configure\").",
  "- Siga o padrão de projeto da Anuntech que vem no contexto. Quando o padrão não fixar uma versão, escreva \"versão estável atual\" em vez de inventar um número.",
  "- Use o briefing, o orçamento e a direção visual do contexto. Funcionalidade que não está no briefing nem no orçamento não entra.",
  "Formato, em Markdown, nesta ordem:",
  "- \"# Prompt de início do projeto\" e, na linha seguinte, o nome do projeto e do cliente.",
  "- \"## Contexto do projeto\": objetivo, público, funcionalidades e o que fica fora do escopo, em poucas linhas.",
  "- \"## Stack e versões\": lista curta.",
  "- \"## Estrutura de pastas\": uma árvore num bloco de código, com src/app, src/components, src/lib, src/db, docs/ e os arquivos de configuração, comentando o que fica em cada pasta.",
  "- \"## AGENTS.md proposto\": o conteúdo completo num bloco de código markdown. Ele manda ler, antes de mudar algo, o que se aplica em docs/: prd.md (produto), architecture.md (onde fica cada coisa), rules.md (regras de trabalho), design.md (visual e escrita), memory.md (decisões) e task.md (pendências), e atualizar o que mudou ao terminar. Traz as regras do produto que o briefing permite afirmar e as regras do padrão.",
  "- \"## Variáveis de ambiente\": só os nomes, cada um com uma frase sobre para que serve e onde se obtém. Nunca valores.",
  "- \"## Setup\": passos numerados com os comandos: repositório privado com `gh repo create anuntech/<slug> --private` (use o slug do contexto), projeto na Vercel no time anuntech ligado ao repositório, projeto na Neon com uma branch de preview, DNS do domínio na Cloudflare apontando para a Vercel. Valores secretos ficam como <valor>.",
  "- \"## Primeiras tarefas\": a partir das fases e tarefas do orçamento, em ordem, cada uma com o que conta como pronto. Sem orçamento, a partir das funcionalidades do briefing, marcadas como a confirmar.",
  "- \"## Em aberto\": perguntas que a equipe precisa responder antes de seguir. Omita a seção se não houver.",
);

const normalized = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugOf = (text: string) => normalized(text).replace(/ /g, "-").slice(0, 60).replace(/-+$/, "") || "projeto";

/** The team's standard from Configurações › Assistente, when a document with that name exists. */
async function projectStandard() {
  const docs = await db.select({ id: assistantDocuments.id, name: assistantDocuments.name }).from(assistantDocuments);
  const match = docs.find((doc) => normalized(doc.name) === normalized(STANDARD_TITLE));
  if (!match) return null;
  const [doc] = await db.select({ content: assistantDocuments.content }).from(assistantDocuments).where(eq(assistantDocuments.id, match.id));
  return doc?.content.trim() ? clip(doc.content.trim(), 8000) : null;
}

/** The Markdown prompt the team pastes into a coding agent to create the project's repository. */
export async function draftJourneyPrompt(journeyId: string, signal?: AbortSignal): Promise<string> {
  const [context, standard] = await Promise.all([journeyContext(journeyId), projectStandard()]);
  const design = context.rows.find((row) => row.key === "design-system")?.aiText?.trim();
  const text = await ask({
    system: PROMPT_PROMPT,
    user: [
      context.text,
      `Slug do repositório: ${slugOf(context.journey.title)}`,
      standard
        ? `${STANDARD_TITLE} (documento da base de conhecimento):\n${standard}`
        : `${STANDARD_TITLE} (padrão embutido no Console; o documento não foi encontrado):\n${DEFAULT_PROJECT_STANDARD}`,
      design ? `Direção visual salva na jornada:\n${clip(design, 2000)}` : "Direção visual: nenhuma salva ainda.",
    ].join("\n\n"),
    maxTokens: 4000,
    temperature: 0.3,
    timeoutMs: 80000,
    signal,
  });
  const out = clip(text, 24000);
  if (standard) return out;
  const notice = `> O documento "${STANDARD_TITLE}" não foi encontrado na base de conhecimento (Configurações › Assistente). Este prompt usa o padrão embutido no Console.`;
  const [first, ...rest] = out.split("\n");
  return first.startsWith("# ") ? [first, "", notice, ...rest].join("\n") : `${notice}\n\n${out}`;
}

/* ---------- design direction ---------- */

const DESIGN_PROMPT = system(
  "Você propõe a direção visual de um projeto de software da Anuntech: paleta, fontes, raio dos cantos e tom, a partir do briefing e das referências do cliente.",
  "- Paleta de 4 a 6 cores: pelo menos um fundo claro, um texto escuro, a cor principal e uma cor de destaque. O texto escuro sobre o fundo claro passa no contraste AA (4,5:1); a cor principal precisa de texto branco ou preto legível sobre ela.",
  "- Se as referências trazem cores ou fontes da marca do cliente, parta delas e diga isso na justificativa. Sem referências, proponha a partir do público e do tipo de projeto e diga que é uma proposta a validar com o cliente.",
  "- Fontes do Google Fonts: uma para títulos e uma para texto (podem ser a mesma).",
  "- raio: \"nenhum\", \"pequeno\", \"medio\" ou \"grande\".",
  "- nome da cor até 40 caracteres, uso até 160. tom: a sensação visual em uma ou duas frases, até 300 caracteres. justificativa: por que essas escolhas servem a este público e a este objetivo, até 600 caracteres.",
  "Responda só com JSON, sem texto antes ou depois:",
  '{"paleta":[{"nome":"","hex":"#000000","uso":""}],"fontes":{"titulos":"","texto":""},"raio":"medio","tom":"","justificativa":""}',
);

/** A palette, fonts, radius and tone for the new project; the screen checks the contrast (swatchContrast). */
export async function draftDesignDirection(journeyId: string, input: { referencias?: string } = {}, signal?: AbortSignal): Promise<DesignDirection> {
  const context = await journeyContext(journeyId);
  const referencias = input.referencias?.trim().slice(0, 2000) ?? "";
  const design = await ask({
    system: DESIGN_PROMPT,
    user: [context.text, referencias ? `Referências do cliente:\n${referencias}` : "Referências do cliente: nenhuma informada."].join("\n\n"),
    maxTokens: 1200,
    temperature: 0.6,
    timeoutMs: 45000,
    signal,
    schema: designDirectionSchema,
  });
  return { ...design, paleta: design.paleta.map((color) => ({ ...color, hex: color.hex.toLowerCase() })) };
}

/* ---------- meeting agendas ---------- */

// The briefing meeting has no step of its own any more: its notes go straight into "Briefing da reunião".
const MEETING_STEP: Record<JourneyMeeting, string> = { briefing: "briefing", inicio: "kickoff", apresentacao: "apresentacao", entrega: "entrega" };

const MEETING_FOCUS: Record<JourneyMeeting, string> = {
  briefing:
    "Reunião de briefing: a primeira conversa sobre o projeto, para entender o negócio e o pedido. As perguntas saem do que falta no briefing (lista \"O que falta no briefing\") e das perguntas em aberto; não pergunte o que já está respondido. Quem decide, verba e prazo entram quando faltarem. A reunião toda em até 60 minutos.",
  inicio:
    "Reunião de início: o projeto começa. A pauta cobre o cronograma pelas fases do orçamento, os responsáveis dos dois lados, os acessos que o projeto precisa (logins, servidores, domínio, contas), o canal de comunicação, como funcionam a Revisão e o aceite no quadro do Console, e o primeiro entregável. Se o contexto mostrar contrato sem assinatura ou entrada sem pagamento, ponha como pendência interna no Checklist, fora da pauta com o cliente. A reunião toda em até 45 minutos.",
  apresentacao:
    "Reunião de apresentação: mostrar o que foi feito e colher o retorno. A pauta passa pelas fases e tarefas concluídas ou em Revisão (lista \"Tarefas do quadro\"), o que vem a seguir e o que precisa da aprovação do cliente. As perguntas colhem retorno sobre cada entrega. Lembre a equipe de separar ajuste dentro do escopo de pedido novo, que vira orçamento ou aditivo. A reunião toda em até 60 minutos.",
  entrega:
    "Reunião de entrega: a última reunião. A pauta mostra o que foi entregue, onde fica e como usar. O Checklist cobre passagem de contas (repositório, Vercel, domínio, banco, e-mail), documentação, treinamento de quem vai usar, aceite formal da entrega com data, saldo, hospedagem e recorrência, garantia e suporte depois da entrega. A reunião toda em até 60 minutos.",
};

const AGENDA_PROMPT = (meeting: JourneyMeeting) =>
  system(
    "Você prepara a pauta de uma reunião da Anuntech com o cliente de um projeto de software.",
    MEETING_FOCUS[meeting],
    "Formato, em Markdown, nesta ordem, começando direto em \"## Pauta\":",
    "- \"## Pauta\": itens numerados, cada um com a duração em minutos entre parênteses.",
    "- \"## Perguntas\": as perguntas a fazer ao cliente, uma por linha, específicas deste projeto.",
    "- \"## Materiais\": o que levar ou mostrar (o orçamento, o quadro, o protótipo, documentos). Não invente links.",
    "- \"## Checklist\": itens com [ ] para a equipe conferir antes, durante e depois da reunião.",
  );

const BRIEFING_FIELDS: [keyof JourneyBriefing, string][] = [
  ["objetivo", "objetivo"],
  ["problema", "problema de hoje"],
  ["publico", "público"],
  ["tipoProjeto", "tipo de projeto"],
  ["funcionalidades", "funcionalidades"],
  ["integracoes", "integrações"],
  ["restricoes", "restrições"],
  ["prazoDesejado", "prazo desejado"],
  ["orcamentoCliente", "verba do cliente"],
  ["decisor", "quem decide"],
];

function briefingGaps(b: JourneyBriefing | null) {
  if (!b) return BRIEFING_FIELDS.map(([, label]) => label);
  return BRIEFING_FIELDS.filter(([key]) => {
    const value = b[key];
    return Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim();
  }).map(([, label]) => label);
}

/** Cards done or in Revisão, for the presentation and the delivery. */
async function boardTasks(projectId: string) {
  const rows = await db
    .select({ title: tasks.title, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.engagementId, projectId), inArray(tasks.status, ["review", "done"])))
    .orderBy(asc(tasks.status), asc(tasks.position))
    .limit(40);
  return rows.map((row) => `- ${clip(row.title, 100)} (${row.status === "done" ? "concluída" : "em Revisão"})`);
}

/** Agenda, questions, materials and checklist for one of the journey's meetings. */
export async function draftMeetingAgenda(journeyId: string, meeting: JourneyMeeting, signal?: AbortSignal): Promise<string> {
  const context = await journeyContext(journeyId);
  const row = context.rows.find((r) => r.key === MEETING_STEP[meeting]);
  const extra: string[] = [`Reunião: ${meetingTitles[meeting]}${row?.scheduledAt ? `, marcada para ${dateLabel(new Date(row.scheduledAt))}` : ""}`];
  if (meeting === "briefing") {
    const gaps = briefingGaps(context.briefing);
    extra.push(gaps.length ? `O que falta no briefing: ${gaps.join(", ")}.` : "O que falta no briefing: os campos principais estão preenchidos; aprofunde as perguntas em aberto.");
  }
  if ((meeting === "apresentacao" || meeting === "entrega") && context.facts.project) {
    const done = await boardTasks(context.facts.project.id);
    extra.push(done.length ? `Tarefas do quadro concluídas ou em Revisão:\n${done.join("\n")}` : "Tarefas do quadro: nenhuma concluída ou em Revisão ainda.");
  }
  const text = await ask({
    system: AGENDA_PROMPT(meeting),
    user: [context.text, ...extra].join("\n\n"),
    maxTokens: 1500,
    temperature: 0.3,
    timeoutMs: 45000,
    signal,
  });
  return clip(text, 10000);
}

/* ---------- how to do a step ---------- */

/** What the Anuntech way is, for the steps where the tools matter; the model fills in the rest for this project. */
const STEP_HINTS: Record<string, string> = {
  repositorio:
    "Repositório privado na organização anuntech: `gh repo create anuntech/<slug> --private --clone`. Branch principal main. .gitignore com .env*; .env.example só com os nomes das variáveis.",
  vercel:
    "Projeto no time anuntech ligado ao repositório do GitHub (Add New › Project no painel, ou `vercel link --scope anuntech` na pasta do projeto). Produção na branch main, preview a cada pull request.",
  neon:
    "Um projeto Neon por cliente, na região mais próxima dos usuários, com uma branch de preview (a integração da Neon com a Vercel pode criar a branch de cada preview). A connection string vai direto para as variáveis da Vercel, nunca para a jornada.",
  variaveis:
    "Na Vercel, Settings › Environment Variables, separadas por Production e Preview, ou `vercel env add <NOME> production`. Localmente, `vercel env pull .env.local`. Na jornada, só a lista de nomes.",
  dominio:
    "Domínio .br registrado no Registro.br em nome do cliente; outros sufixos no registrador que o cliente escolher. Anote o domínio e onde está registrado.",
  cloudflare:
    "Zona do domínio na Cloudflare e os nameservers trocados no registrador. Os registros que a Vercel mostra em Settings › Domains, com o proxy desligado (DNS only). SSL/TLS em Full (strict).",
  "email-dominio":
    "No Resend, Domains › Add domain, de preferência com um subdomínio de envio. Os registros SPF, DKIM e MX que o Resend mostrar vão para a Cloudflare; DMARC em _dmarc começando com p=none. Espere a verificação antes de enviar.",
  monitoramento:
    "Vercel Web Analytics e Speed Insights no projeto; alerta de erro e de queda com a ferramenta que a equipe usa, avisando a equipe antes do cliente.",
  lgpd:
    "Política de privacidade, termos de uso e aviso de cookies quando o sistema guarda dados de pessoas: quais dados, para quê, por quanto tempo e quem atende os pedidos dos titulares do lado do cliente.",
  acessos:
    "Lista do que o projeto precisa do cliente (contas, servidores, domínio, APIs). Credenciais vão para o cofre de senhas da equipe; na jornada, só o que já foi recebido e o que falta.",
  garantia: "A garantia conta a partir do aceite da entrega, pelo prazo do contrato. Registre a data final.",
  suporte: "Contrato de suporte ou banco de horas para o que vier depois da entrega; o cliente abre chamados pelo Console.",
  passagem: "Quem é dono de cada conta (repositório, Vercel, Neon, domínio, Cloudflare, Resend) e onde está a documentação.",
  treinamento: "Sessão com quem vai usar o sistema, nas tarefas do dia a dia; um guia curto ou um vídeo fica com o cliente.",
  "prompt-projeto": "O botão de IA deste passo escreve o prompt de início com a estrutura, a stack e o AGENTS.md.",
  "design-system": "O botão de IA deste passo propõe paleta, fontes e raio com o contraste conferido.",
};

const FIELD_LABELS: Record<string, string> = { url: "link", value: "valor", date: "data", note: "nota" };

const STEP_PROMPT = system(
  "Você orienta um passo da jornada de um projeto de software da Anuntech: como fazer este passo, neste projeto, do jeito da Anuntech.",
  "- Seja concreto: passos numerados, comandos em blocos de código com <marcadores> no lugar dos valores, nomes oficiais das ferramentas e das telas (GitHub, Vercel, Neon, Cloudflare, Resend, Registro.br).",
  "- Use as dicas da Anuntech para o passo quando vierem no contexto. Não invente opções de comando: na dúvida, aponte a tela da ferramenta.",
  "- Segredos nunca entram na jornada: senhas e chaves ficam nas variáveis da Vercel ou no cofre de senhas da equipe.",
  "Formato, em Markdown, nesta ordem, começando direto em \"## Como fazer\":",
  "- \"## Como fazer\": checklist numerada.",
  "- \"## O que registrar na jornada\": os campos do passo (link, valor, data, nota) e o que pôr em cada um.",
  "- \"## Cuidados\": até três pontos que costumam dar errado neste passo. Omita se não houver.",
  "Até 350 palavras.",
);

function findStep(context: JourneyContext, key: string): ResolvedStep | null {
  for (const stage of context.resolved.stages) {
    const found = [...stage.steps, ...stage.optional].find((s) => s.def.key === key);
    if (found) return found;
  }
  return null;
}

/** How to do one step (template or added by the team) for this project. */
export async function draftStepHelp(journeyId: string, stepKey: string, signal?: AbortSignal): Promise<string> {
  const context = await journeyContext(journeyId);
  const step = (templateStep(stepKey) || isExtraKey(stepKey)) && findStep(context, stepKey);
  if (!step) throw new AssistantError("Este passo não existe nesta jornada.");
  const fields = step.def.fields ?? [];
  const lines = [
    `Passo: ${step.def.title} (etapa ${stageTitle(step.def.stage)})`,
    step.extra ? "Passo acrescentado pela equipe nesta jornada; o título diz o que é." : `O que é: ${step.def.help}`,
    `Situação: ${STATUS_LABELS[step.status]}${step.detail ? ` (${clip(step.detail, 160)})` : ""}`,
    fields.length ? `Campos do passo na jornada: ${fields.map((field) => (field === "value" && step.def.valueLabel ? step.def.valueLabel : FIELD_LABELS[field])).join(", ")}` : "Campos do passo na jornada: nenhum; o Console marca sozinho pelos dados.",
    step.def.urlHint ? `Exemplo de link: ${step.def.urlHint}` : null,
    STEP_HINTS[stepKey] ? `Dicas da Anuntech: ${STEP_HINTS[stepKey]}` : null,
    `Slug sugerido do projeto: ${slugOf(context.journey.title)}`,
  ].filter(Boolean);
  const text = await ask({
    system: STEP_PROMPT,
    user: [context.text, lines.join("\n")].join("\n\n"),
    maxTokens: 1500,
    temperature: 0.3,
    timeoutMs: 45000,
    signal,
  });
  return clip(text, 10000);
}

/* ---------- client feedback ---------- */

const FEEDBACK_PROMPT = system(
  "Você separa o retorno do cliente de um projeto de software da Anuntech, comparando cada pedido com o escopo do orçamento.",
  "- Quebre o retorno em pedidos, um por item, resumidos nas palavras do cliente.",
  "- Ajuste dentro do escopo: corrige ou refina algo que já está numa fase ou tarefa do orçamento. Diga qual fase.",
  "- Novo pedido: algo que o orçamento não cobre. Vira orçamento novo ou aditivo; não diga valor nem prazo.",
  "- Dúvida ou decisão do cliente: pergunta, escolha que só o cliente pode fazer, ou pedido ambíguo.",
  "- Cada item com uma linha de justificativa. Na dúvida entre ajuste e novo pedido, ponha em Dúvida ou decisão do cliente e diga o que confirmar.",
  "- Sem orçamento no contexto não há escopo para comparar: diga isso numa linha no fim e trate como dúvida o que depender do escopo.",
  "Formato, em Markdown, com as três seções nesta ordem, mesmo vazias (escreva \"Nada neste grupo.\"):",
  "## Ajuste dentro do escopo",
  "- **<pedido>** (fase <nome da fase>): <justificativa>",
  "## Novo pedido (vira orçamento ou aditivo)",
  "- **<pedido>**: <justificativa>",
  "## Dúvida ou decisão do cliente",
  "- **<pedido>**: <justificativa>",
);

/** The client's feedback split into in-scope adjustments, new requests and questions. */
export async function triageFeedback(journeyId: string, retorno: string, signal?: AbortSignal): Promise<string> {
  const feedback = retorno.trim().slice(0, 8000);
  if (!feedback) throw new AssistantError("Cole o retorno do cliente antes.");
  const context = await journeyContext(journeyId);
  const text = await ask({
    system: FEEDBACK_PROMPT,
    user: [context.text, `Retorno do cliente:\n${feedback}`].join("\n\n"),
    maxTokens: 1500,
    temperature: 0.2,
    timeoutMs: 45000,
    signal,
  });
  return clip(text, 10000);
}

/* ---------- missing steps ---------- */

export type JourneyGap = { titulo: string; etapa: JourneyStage; motivo: string };

const GAPS_PROMPT = system(
  "Você aponta o que falta na jornada de um projeto de software da Anuntech: passos que este projeto precisa e que não estão na lista de passos do contexto.",
  "- Olhe o briefing, o orçamento e o tipo de projeto: integrações, pagamentos, publicação em lojas de aplicativos, migração de dados, conteúdo, SEO, acessibilidade, testes com usuários, backups.",
  "- Nunca repita um passo que já está na lista, nem com outro nome.",
  "- Cada passo: titulo curto (até 80 caracteres), etapa (uma das chaves abaixo) e motivo ligado a algo do contexto (até 200 caracteres).",
  "- No máximo 8. Se nada faltar, devolva a lista vazia.",
  `Etapas: ${JOURNEY_STAGES.map((stage) => `${stage.key} (${stage.title})`).join(", ")}.`,
  "Responda só com JSON, sem texto antes ou depois:",
  '{"passos":[{"titulo":"","etapa":"setup","motivo":""}]}',
);

const gapsAnswer = z.object({
  passos: z
    .array(z.object({ titulo: z.string().trim().min(1).max(80), etapa: z.enum(journeyStageKeys), motivo: z.string().trim().max(200).default("") }))
    .max(16)
    .default([]),
});

/** Up to 8 steps this project seems to need that neither the template nor the journey has. */
export async function suggestMissingSteps(journeyId: string, signal?: AbortSignal): Promise<JourneyGap[]> {
  const context = await journeyContext(journeyId);
  const answer = await ask({
    system: GAPS_PROMPT,
    user: context.text,
    maxTokens: 1200,
    temperature: 0.4,
    timeoutMs: 45000,
    signal,
    schema: gapsAnswer,
  });
  const taken = new Set([
    ...JOURNEY_TEMPLATE.map((def) => normalized(def.title)),
    ...context.rows.filter((row) => isExtraKey(row.key) && row.title).map((row) => normalized(row.title!)),
  ]);
  const gaps: JourneyGap[] = [];
  for (const gap of answer.passos) {
    const key = normalized(gap.titulo);
    if (!key || taken.has(key)) continue;
    taken.add(key);
    gaps.push(gap);
    if (gaps.length === 8) break;
  }
  return gaps;
}
