import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { contracts, engagements, journeys, quotes } from "@/db/schema";
import { db } from "../db";
import { AssistantError } from "../assistant/assistant-errors";
import { assertGateway } from "../assistant/chat-model";
import { oneShot, OUT_OF_FORMAT } from "../assistant/one-shot";
import { journeyContext, scrub } from "../journeys/journey-ai";
import { currency } from "../format";
import { quoteNumberLabel, quoteTotals } from "../quotes/quote-model";

/*
 * "Revisar com IA" in a draft contract: what could be better before it goes out — the text against the
 * proposal and the project (values, scope, deadlines, hosting), clauses that do not fit this project,
 * gaps and risks for Anuntech. Points to look at, never a rewrite and never legal advice; nothing is
 * saved. One private call through the AI Gateway (one-shot.ts).
 */

export type ReviewPoint = { title: string; where: string; issue: string; suggestion: string; level: "alta" | "media" | "baixa" };

const BODY_CHARS = 24000;

const answer = z.object({
  pontos: z
    .array(
      z.object({
        titulo: z.string().trim().min(1).max(120),
        onde: z.string().trim().max(120).default(""),
        problema: z.string().trim().max(500),
        sugestao: z.string().trim().max(600),
        gravidade: z.enum(["alta", "media", "baixa"]).default("media"),
      }),
    )
    .max(8),
});

const PROMPT = [
  "Você revisa o rascunho de um contrato de desenvolvimento de software da Anuntech antes de ele ir para assinatura, em português do Brasil.",
  "Compare o texto com o contexto do projeto (orçamento, briefing, jornada, serviços da empresa) e aponte o que dá para melhorar, do mais importante para o menos. No máximo 8 pontos; menos é melhor que pontos fracos.",
  "Procure: divergências entre o contrato e o orçamento (valor, entrada e saldo, escopo, fases, prazos, tecnologias); campos {{assim}} ainda abertos; cláusulas que não combinam com este projeto (por exemplo app de loja sem falar de contas de loja, dados pessoais sem cláusula de dados); o que o briefing promete e o contrato não cobre; riscos para a Anuntech (escopo aberto, prazo sem dependência do cliente, aceite sem prazo, falta de limite para alterações).",
  "Não reescreva o contrato. Não invente fatos, valores ou datas. Não dê conselho jurídico definitivo: diga o que conferir e uma sugestão objetiva de ajuste.",
  "titulo: o ponto em poucas palavras. onde: a cláusula ou o trecho (por exemplo 'Cláusula 5.2' ou 'Anexo II'). problema: o que está errado ou faltando, em uma ou duas frases. sugestao: o que fazer, em uma ou duas frases. gravidade: alta (pode gerar prejuízo ou disputa), media ou baixa.",
  "Responda só com JSON, sem texto antes ou depois:",
  '{"pontos":[{"titulo":"","onde":"","problema":"","sugestao":"","gravidade":"media"}]}',
].join("\n");

export async function reviewContractDraft(contractId: string, signal?: AbortSignal): Promise<ReviewPoint[]> {
  assertGateway();
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) throw new AssistantError("Contrato não encontrado.");
  const [quote] = contract.quoteId
    ? await db.select().from(quotes).where(and(eq(quotes.id, contract.quoteId), eq(quotes.companyId, contract.companyId)))
    : await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.companyId, contract.companyId), inArray(quotes.status, ["accepted", "sent"])))
        .orderBy(desc(eq(quotes.status, "accepted")), desc(quotes.decidedAt))
        .limit(1);
  const [journey] = await db
    .select({ id: journeys.id })
    .from(journeys)
    .where(quote ? eq(journeys.quoteId, quote.id) : eq(journeys.companyId, contract.companyId))
    .orderBy(desc(journeys.createdAt))
    .limit(1);
  const services = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(and(eq(engagements.companyId, contract.companyId), inArray(engagements.status, ["active", "paused"])))
    .limit(20);

  const sections: string[] = [];
  sections.push(services.length ? `Serviços da empresa com a Anuntech: ${services.map((s) => s.name).join("; ")}` : "Serviços da empresa com a Anuntech: nenhum ativo.");
  if (quote) {
    const content = quote.publication ?? { ...quote.content, title: quote.title };
    const totals = quoteTotals(content);
    sections.push(
      [
        `Orçamento ${quoteNumberLabel(quote.year, quote.seq)}: ${quote.title} (${quote.status === "accepted" ? "aceito" : quote.status === "sent" ? "enviado" : "rascunho"})`,
        totals.totalCents ? `Total: ${currency(totals.totalCents)}` : null,
        totals.upfrontCents ? `Entrada: ${currency(totals.upfrontCents)} (${content.upfrontPercent}%)` : null,
        totals.balanceCents ? `Saldo: ${currency(totals.balanceCents)}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (journey) sections.push((await journeyContext(journey.id)).text);
  else if (quote) {
    const content = quote.publication ?? quote.content;
    sections.push(
      [
        content.summary?.trim() && `Resumo do orçamento: ${content.summary.trim().slice(0, 1500)}`,
        content.stack?.length && `Stack: ${content.stack.join(", ")}`,
        ...(content.phases ?? []).map((phase, i) => `Fase ${i + 1}: ${phase.name}${phase.weeks ? ` (${phase.weeks} semanas)` : ""}`),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  const body = contract.body.length > BODY_CHARS ? `${contract.body.slice(0, BODY_CHARS)}\n(o resto do texto foi cortado)` : contract.body;
  let parsed: z.infer<typeof answer>;
  try {
    parsed = await oneShot({
      system: PROMPT,
      user: scrub(`Contexto do projeto:\n${sections.join("\n\n") || "Sem orçamento nem jornada no Console."}\n\nContrato: ${contract.title}\n\n${body}`),
      maxTokens: 3000,
      temperature: 0.2,
      timeoutMs: 58000,
      reasoning: false,
      signal,
      schema: answer,
    });
  } catch (error) {
    if (error instanceof AssistantError && error.message === OUT_OF_FORMAT) throw new AssistantError("A revisão não veio num formato que o Console aceita. Tente de novo.");
    throw error;
  }
  const order = { alta: 0, media: 1, baixa: 2 } as const;
  return parsed.pontos
    .map((p) => ({ title: p.titulo, where: p.onde, issue: p.problema, suggestion: p.sugestao, level: p.gravidade }))
    .sort((a, b) => order[a.level] - order[b.level]);
}
