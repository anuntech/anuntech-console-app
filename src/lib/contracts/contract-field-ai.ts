import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { contracts, engagements, journeys, quotes } from "@/db/schema";
import { db } from "../db";
import { AssistantError } from "../assistant/assistant-errors";
import { assertGateway } from "../assistant/chat-model";
import { oneShot, OUT_OF_FORMAT } from "../assistant/one-shot";
import { journeyContext, scrub } from "../journeys/journey-ai";
import { currency, longDateLabel } from "../format";
import { quoteNumberLabel, quoteTotals } from "../quotes/quote-model";
import { contractFields, fieldLabel } from "./contract-fields";
import type { FieldSuggestion } from "./contract-suggestions";

/*
 * "Preencher com IA" in a draft contract: the fields that depend on the project (hosting, personal
 * data, pre-existing materials, paid components, the timeline) read from what the Console knows about
 * it — the proposal, the journey's briefing and steps — and come back as suggestions the team reviews
 * in the fields panel. Nothing is written here. Never names, e-mails, documents, prices or dates the
 * data does not have: those come from the Console's own records (contract-suggestions.ts) or stay
 * empty with what is missing. One private call through the AI Gateway (one-shot.ts).
 */

export type AiFieldSuggestion = FieldSuggestion & { check: boolean };
export type AiFieldGap = { key: string; missing: string };

const PARAGRAPH = 700;
const BODY_FIELDS = 30;

const answer = z.object({
  campos: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z_]+$/).max(64),
        valor: z.string().trim().max(1500).default(""),
        fonte: z.enum(["orçamento", "briefing", "jornada", "padrão", "falta"]).default("falta"),
        motivo: z.string().trim().max(200).default(""),
        confira: z.boolean().default(true),
      }),
    )
    .max(BODY_FIELDS),
});

const PROMPT = [
  "Você ajuda a equipe da Anuntech a preencher os campos em aberto de um contrato de desenvolvimento de software, em português do Brasil.",
  "Cada campo vem com o trecho do contrato onde ele aparece: é o trecho que diz o que o campo pede. Leia o trecho antes de responder.",
  "Sugira um valor para todos os campos. A equipe confere cada sugestão antes de usar, então um bom palpite vale mais que um campo vazio.",
  "Ordem de preferência: 1) o que o contexto do projeto diz (orçamento, briefing, jornada, serviços da empresa); 2) o padrão da Anuntech abaixo; 3) uma dedução razoável a partir das funcionalidades.",
  "Padrões da Anuntech, quando o projeto não diz outra coisa:",
  "- Hospedagem: o software roda na Anuntech Cloud (infraestrutura da Anuntech em nuvem, no Brasil), contratada e cobrada à parte; custos de serviços de terceiros que o projeto usar são pagos pelo CLIENTE. Se a empresa já tem um serviço de hospedagem ou nuvem ativo, cite-o pelo nome.",
  "- Ativos da Anuntech (contas, aplicativos e domínios que ficam em nome da Anuntech): nenhum; domínio, contas de loja e contas de serviços ficam em nome do CLIENTE.",
  "- Materiais preexistentes: nenhum; só cite componentes ou bibliotecas da Anuntech quando o orçamento ou o briefing disserem que serão reaproveitados.",
  "- Componentes pagos: nenhum, a menos que o projeto cite serviço pago (mapas, SMS, WhatsApp, pagamentos, IA); nesse caso, nome do serviço, licenciado em nome do CLIENTE e pago por ele.",
  "- Dados pessoais: deduza pelas funcionalidades (por exemplo nome, e-mail e telefone dos usuários e dos clientes do CLIENTE); titulares são esses usuários e clientes; diga que não há dados sensíveis nem de crianças e adolescentes quando nada indicar o contrário.",
  "- Cronograma e pagamento: as fases do orçamento na ordem, com as semanas, e o pagamento: a entrada na assinatura e o saldo na entrega, com os valores do orçamento.",
  "Nunca invente nome de pessoa, e-mail, telefone, CNPJ, valor em reais ou data que o contexto não traga. Se o campo pede isso e o contexto não tem, deixe valor \"\", fonte \"falta\" e em motivo a pergunta curta a fazer ao cliente.",
  "Escreva no tom do contrato: frases completas, sem markdown, sem listas com marcadores, sem aspas em volta, sem repetir o rótulo do campo.",
  "fonte: \"orçamento\", \"briefing\", \"jornada\" (inclui os serviços da empresa), \"padrão\" (padrão da Anuntech ou dedução) ou \"falta\".",
  "motivo: de onde veio o valor (por exemplo 'Fases e entrada do orçamento' ou 'Padrão da Anuntech') ou o que falta, até 140 caracteres.",
  "confira: true sempre que o valor vier de padrão ou dedução; false só quando está escrito no contexto.",
  "Responda só com JSON, um item por campo pedido, sem texto antes ou depois:",
  '{"campos":[{"key":"","valor":"","fonte":"orçamento","motivo":"","confira":true}]}',
].join("\n");

const SOURCE_LABELS: Record<z.infer<typeof answer>["campos"][number]["fonte"], string> = {
  orçamento: "Sugestão da IA a partir do orçamento",
  briefing: "Sugestão da IA a partir do briefing",
  jornada: "Sugestão da IA a partir da jornada",
  padrão: "Sugestão da IA pelo padrão da Anuntech",
  falta: "Sugestão da IA",
};

/** The paragraph a placeholder sits in, which says what the field asks for. */
function paragraphOf(body: string, key: string) {
  const at = body.indexOf(`{{${key}}}`);
  if (at < 0) return "";
  const start = Math.max(body.lastIndexOf("\n\n", at) + 2, at - PARAGRAPH);
  const nextBreak = body.indexOf("\n\n", at);
  const end = Math.min(nextBreak < 0 ? body.length : nextBreak, at + PARAGRAPH);
  return body.slice(start, end).trim();
}

export async function draftContractFields(
  contractId: string,
  known: Record<string, FieldSuggestion>,
  signal?: AbortSignal,
): Promise<{ suggestions: Record<string, AiFieldSuggestion>; gaps: AiFieldGap[] }> {
  assertGateway();
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) throw new AssistantError("Contrato não encontrado.");
  // The project's fields only: what the Console already knows stays as it is.
  const fields = contractFields(contract.body).filter((field) => !known[field.key]).slice(0, BODY_FIELDS);
  if (!fields.length) return { suggestions: {}, gaps: [] };

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
  const fallback = !journey && quote
    ? (await db.select({ id: journeys.id }).from(journeys).where(eq(journeys.companyId, contract.companyId)).orderBy(desc(journeys.createdAt)).limit(1))[0]
    : undefined;
  const journeyId = journey?.id ?? fallback?.id;

  // What the company already has with Anuntech: a hosting or cloud service answers "hospedagem".
  const services = await db
    .select({ name: engagements.name })
    .from(engagements)
    .where(and(eq(engagements.companyId, contract.companyId), inArray(engagements.status, ["active", "paused"])))
    .limit(20);
  const sections: string[] = [`Contrato: ${contract.title}`];
  sections.push(services.length ? `Serviços da empresa com a Anuntech: ${services.map((x) => x.name).join("; ")}` : "Serviços da empresa com a Anuntech: nenhum ativo.");
  if (quote) {
    const content = quote.publication ?? { ...quote.content, title: quote.title };
    const totals = quoteTotals(content);
    sections.push(
      [
        `Orçamento ${quoteNumberLabel(quote.year, quote.seq)}: ${quote.title} (${quote.status === "accepted" ? "aceito" : "enviado"})`,
        totals.totalCents ? `Total: ${currency(totals.totalCents)}` : null,
        totals.upfrontCents ? `Entrada: ${currency(totals.upfrontCents)} (${content.upfrontPercent}% do total), na assinatura` : null,
        totals.balanceCents ? `Saldo: ${currency(totals.balanceCents)}` : null,
        content.hourlyRateCents ? `Valor da hora: ${currency(content.hourlyRateCents)}` : null,
        quote.validUntil ? `Válido até ${longDateLabel(quote.validUntil)}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (journeyId) sections.push((await journeyContext(journeyId)).text);
  else if (quote) {
    const content = quote.publication ?? quote.content;
    sections.push(
      [
        content.summary?.trim() && `Resumo do orçamento: ${content.summary.trim().slice(0, 1500)}`,
        content.stack?.length && `Stack: ${content.stack.join(", ")}`,
        ...(content.phases ?? []).map((phase, i) => `Fase ${i + 1}: ${phase.name}${phase.weeks ? ` (${phase.weeks} semanas)` : ""}${phase.description ? `: ${phase.description.slice(0, 200)}` : ""}`),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } else sections.push("Projeto: sem orçamento nem jornada no Console.");

  const asked = fields.map((field) => `- ${field.key} (${fieldLabel(field.key)}):\n  Trecho: ${paragraphOf(contract.body, field.key)}`).join("\n");
  let parsed: z.infer<typeof answer>;
  try {
    parsed = await oneShot({
      system: PROMPT,
      user: scrub(`Contexto do projeto:\n${sections.join("\n\n")}\n\nCampos em aberto:\n${asked}`),
      maxTokens: 3000,
      temperature: 0.2,
      timeoutMs: 55000,
      reasoning: false,
      signal,
      schema: answer,
    });
  } catch (error) {
    if (error instanceof AssistantError && error.message === OUT_OF_FORMAT)
      throw new AssistantError("A sugestão não veio num formato que o Console aceita. Tente de novo ou preencha à mão.");
    throw error;
  }

  const open = new Set(fields.map((field) => field.key));
  const suggestions: Record<string, AiFieldSuggestion> = {};
  const gaps: AiFieldGap[] = [];
  for (const item of parsed.campos) {
    if (!open.has(item.key) || suggestions[item.key] || gaps.some((gap) => gap.key === item.key)) continue;
    if (!item.valor || item.fonte === "falta") {
      gaps.push({ key: item.key, missing: item.motivo || "O projeto não diz. Pergunte ao cliente." });
      continue;
    }
    suggestions[item.key] = {
      value: item.valor,
      source: item.motivo ? `${SOURCE_LABELS[item.fonte]}: ${item.motivo}` : SOURCE_LABELS[item.fonte],
      check: item.confira,
    };
  }
  return { suggestions, gaps };
}
