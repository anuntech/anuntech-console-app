import "server-only";
import { brandEmailHtml } from "@/lib/email/brand-email";
import { randomUUID } from "node:crypto";
import { currency, longDateLabel } from "../format";

async function send(input: { to: string; subject: string; text: string; tag: string; eyebrow?: string; audience?: "client" | "staff" }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `${input.tag}-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: brandEmailHtml({ subject: input.subject, text: input.text, eyebrow: input.eyebrow, audience: input.audience }),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.id) throw new Error("Não foi possível enviar o aviso por e-mail.");
}

/** Tells a client contact that a proposal awaits their answer in the Console. */
export async function deliverQuoteNotice(
  email: string,
  input: {
    companyName: string;
    title: string;
    number: string;
    url: string;
    totalCents: number;
    validUntil: string | null;
    version?: number;
  },
) {
  const again = (input.version ?? 1) > 1 ? ` Esta é uma nova versão (${input.version}); a anterior deixou de valer.` : "";
  const validity = input.validUntil ? `\nVálido até: ${longDateLabel(input.validUntil)}` : "";
  await send({
    to: email,
    tag: "quote",
    eyebrow: (input.version ?? 1) > 1 ? "Nova versão do orçamento" : "Novo orçamento",
    subject: `Orçamento ${input.number}: ${input.title}`,
    text: `A Anuntech enviou o orçamento ${input.number}, "${input.title}", para ${input.companyName}.${again}\n\nValor total: ${currency(input.totalCents)}${validity}\n\nVeja o detalhamento e responda pelo Console: ${input.url}\n\nVocê responde com o seu acesso ao Console, que confirma sua identidade pelo e-mail ou WhatsApp cadastrado.\n\nAnuntech`,
  });
}
