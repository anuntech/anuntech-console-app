import "server-only";
import { z } from "zod";
import { AssistantError } from "./assistant-errors";
import { assertGateway } from "./chat-model";
import { oneShot, OUT_OF_FORMAT } from "./one-shot";
import type { QuotePhase } from "../quotes/quote-model";

/*
 * First phases for a proposal from what the client asked: the model reads
 * the title and the summary and proposes phases, hours and tasks. The team
 * sees them in the editor, adjusts and saves; nothing is saved or sent here.
 * One private call through the AI Gateway (one-shot.ts).
 */

const line = z.string().trim().min(1).max(160);
const phases = z
  .array(
    z.object({
      name: line,
      description: z.string().trim().max(600).default(""),
      hoursMin: z.number().int().min(1).max(2000),
      hoursMax: z.number().int().min(1).max(2000),
      weeks: z.number().int().min(1).max(52).nullable().default(null),
      tasks: z.array(z.object({ title: line, description: z.string().trim().max(400).default("") })).max(15).default([]),
    }),
  )
  .min(1)
  .max(12);
const answer = z.object({ phases, stack: z.array(line).max(12).default([]) });

const PROMPT = [
  "Você monta o primeiro rascunho de um orçamento de software da Anuntech, em português do Brasil.",
  "A partir do pedido, proponha de 2 a 6 fases na ordem do trabalho (por exemplo descoberta, construção, testes e implantação), cada uma com descrição curta, faixa de horas (mínimo e máximo, números inteiros), semanas e de 2 a 8 tarefas com título e uma frase.",
  "Seja conservador nas horas. Não invente integrações ou funções que o pedido não cita; quando algo for incerto, deixe numa fase de descoberta.",
  'Responda só com JSON: {"phases":[{"name":"","description":"","hoursMin":0,"hoursMax":0,"weeks":0,"tasks":[{"title":"","description":""}]}],"stack":[""]}',
].join("\n");

export async function draftQuotePhases(input: { title: string; summary: string }): Promise<{ phases: QuotePhase[]; stack: string[] }> {
  assertGateway();
  let parsed: z.infer<typeof answer>;
  try {
    parsed = await oneShot({
      system: PROMPT,
      user: `Título: ${input.title.slice(0, 160)}\n\nPedido do cliente:\n${input.summary.slice(0, 4000)}`,
      maxTokens: 2500,
      temperature: 0.2,
      timeoutMs: 55000,
      // Long JSON: no reasoning option, so no thinking is asked for (the model's default applies, as before).
      reasoning: false,
      schema: answer,
    });
  } catch (error) {
    if (error instanceof AssistantError && error.message === OUT_OF_FORMAT)
      throw new AssistantError("A sugestão não veio num formato que o Console aceita. Tente de novo ou monte as fases à mão.");
    throw error;
  }
  return {
    phases: parsed.phases.map((p) => ({ ...p, hoursMax: Math.max(p.hoursMax, p.hoursMin) })),
    stack: parsed.stack,
  };
}
