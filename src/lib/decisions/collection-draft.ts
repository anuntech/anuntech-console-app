import "server-only";
import { oneShot } from "../assistant/one-shot";
import { scrub } from "../journeys/journey-ai";
import { protectLinks, restoreLinks } from "./collection-text";

/*
 * The collection message the queue shows, adapted by the team's model to
 * the history (how late, a promise already broken, a client who left). The
 * base text is the one Atrasos already writes (collections.ts); the payment
 * links never leave: they go as a marker and come back in place. Without the
 * model, or when it answers badly, the base text stays. Nothing is sent.
 */

const SYSTEM = [
  "Você ajusta uma mensagem de cobrança que a equipe da Anuntech vai ler, editar e enviar por WhatsApp ou e-mail a um cliente.",
  "Regras:",
  "- Português do Brasil, na voz da Anuntech: trate por você, frases curtas e diretas, cordial e firme, sem ameaça. Sem ponto de exclamação, sem travessão ligando frases.",
  "- Mantenha todos os fatos da mensagem original: empresa, descrição, datas, valores e a frase sobre suspensão, se houver. Não invente nada: nem desconto, nem prazo, nem consequência.",
  "- Mantenha o marcador [[LINKS]] exatamente como está, numa linha própria.",
  "- Não escreva e-mail, telefone, CPF ou CNPJ.",
  "- Responda só com a mensagem, sem comentário antes ou depois.",
].join("\n");

export async function collectionDraft(input: { message: string; oldestDays: number; invoices: number; contactNote: string | null; archived: boolean }): Promise<{ text: string; ai: boolean }> {
  const { text: base, links } = protectLinks(input.message);
  const context = [
    `Dias de atraso da fatura mais antiga: ${input.oldestDays}.`,
    `Faturas vencidas: ${input.invoices}.`,
    input.archived ? "O cliente encerrou o serviço com a Anuntech, mas a dívida continua." : null,
    input.contactNote ? `Último contato registrado pela equipe: ${scrub(input.contactNote)}` : "Nenhum contato de cobrança registrado antes.",
    "",
    "Mensagem original:",
    base,
  ]
    .filter((line) => line !== null)
    .join("\n");
  try {
    const answer = (await oneShot({ system: SYSTEM, user: context, maxTokens: 700, temperature: 0.3, timeoutMs: 30_000, reasoning: false })).trim();
    const restored = restoreLinks(answer, links);
    if (!restored) return { text: input.message, ai: false };
    return { text: restored, ai: true };
  } catch {
    return { text: input.message, ai: false };
  }
}
