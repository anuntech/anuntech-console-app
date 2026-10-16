import "server-only";
import { asc, eq } from "drizzle-orm";
import { companies, messages, tickets, user } from "@/db/schema";
import { db } from "../db";
import { termsSummary } from "../service-terms/terms-text";
import { visibleToClient } from "../service-terms/ticket-clock";
import { ticketLabels } from "../format";
import { assistantConfig, PRIVATE_PROVIDERS } from "./assistant";

/*
 * A reply the team reviews before sending: the model reads the ticket's
 * conversation and the company's conditions and writes in Anuntech's voice.
 * It goes into the reply box only; the person edits and sends it.
 */

const VOICE = [
  "Você escreve a próxima resposta da equipe da Anuntech num chamado de suporte, em português do Brasil.",
  "Trate o cliente por você. Frases curtas e diretas, sem ponto de exclamação, sem travessão, sem jargão e sem assinatura.",
  "Responda ao que o cliente disse por último. Se faltar informação para resolver, peça exatamente o que falta.",
  "Nunca prometa prazo, valor ou condição que não esteja nas condições de atendimento abaixo. Não invente fatos sobre o sistema do cliente.",
  "Devolva só o texto da resposta, pronto para enviar.",
].join("\n");

export async function draftTicketReply(ticketId: string) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("O assistente ainda não foi ligado: falta a chave do OpenRouter.");
  const [row] = await db
    .select({ ticket: tickets, company: companies.name })
    .from(tickets)
    .innerJoin(companies, eq(companies.id, tickets.companyId))
    .where(eq(tickets.id, ticketId));
  if (!row) throw new Error("Chamado não encontrado.");
  const conversation = await db
    .select({ body: messages.body, at: messages.createdAt, author: user.name })
    .from(messages)
    .innerJoin(user, eq(user.id, messages.authorId))
    .where(eq(messages.ticketId, ticketId))
    .orderBy(asc(messages.createdAt));
  // Only what the client can already read; unpublished conditions are never quoted.
  const terms = row.ticket.terms && visibleToClient(row.ticket.terms, new Date()) ? termsSummary(row.ticket.terms) : null;
  const context = [
    `Empresa: ${row.company}`,
    `Assunto: ${row.ticket.subject}`,
    `Situação: ${ticketLabels[row.ticket.status]}`,
    row.ticket.waitingFor ? `O que a equipe pediu ao cliente: ${row.ticket.waitingFor}` : null,
    terms ? `Condições de atendimento:\n${[...terms.promises, ...terms.asks].map((fact) => `- ${fact.text}`).join("\n")}` : "Sem condições de atendimento cadastradas: não cite prazos.",
    "Conversa, da mais antiga para a mais recente:",
    // Names, not e-mail addresses: the provider needs to know who spoke, not how to reach them.
    ...conversation.slice(-15).map((m) => `[${m.author || "Sem nome"}] ${m.body.slice(0, 1500)}`),
  ]
    .filter(Boolean)
    .join("\n\n");
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
        { role: "system", content: VOICE },
        { role: "user", content: context },
      ],
      temperature: 0.3,
      max_tokens: 700,
      provider: PRIVATE_PROVIDERS,
    }),
    signal: AbortSignal.timeout(45000),
  });
  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!res.ok || !text) throw new Error("O modelo não respondeu agora. Tente de novo ou escreva a resposta.");
  return text.slice(0, 4000);
}
