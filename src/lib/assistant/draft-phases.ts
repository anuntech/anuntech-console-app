import "server-only";
import { z } from "zod";
import { assistantConfig } from "./assistant";
import type { QuotePhase } from "../quotes/quote-model";

/*
 * First phases for a proposal from what the client asked: the model reads
 * the title and the summary and proposes phases, hours and tasks. The team
 * sees them in the editor, adjusts and saves; nothing is saved or sent here.
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
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("O assistente ainda não foi ligado: falta a chave do OpenRouter.");
  const { model } = await assistantConfig();
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
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: `Título: ${input.title.slice(0, 160)}\n\nPedido do cliente:\n${input.summary.slice(0, 4000)}` },
      ],
      temperature: 0.2,
      max_tokens: 2500,
    }),
    signal: AbortSignal.timeout(55000),
  });
  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let parsed: z.infer<typeof answer>;
  try {
    parsed = answer.parse(JSON.parse(json));
  } catch {
    throw new Error("A sugestão não veio num formato que o Console aceita. Tente de novo ou monte as fases à mão.");
  }
  return {
    phases: parsed.phases.map((p) => ({ ...p, hoursMax: Math.max(p.hoursMax, p.hoursMin) })),
    stack: parsed.stack,
  };
}
