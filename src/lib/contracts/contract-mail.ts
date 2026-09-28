import "server-only";
import { randomUUID } from "node:crypto";
import { longDateLabel } from "../format";

async function send(input: { to: string; subject: string; text: string; tag: string }) {
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
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.id) throw new Error("Não foi possível enviar o aviso por e-mail.");
}

/** Tells a client contact that a contract awaits their signature in the Console. */
export async function deliverContractNotice(
  email: string,
  input: { companyName: string; title: string; url: string; kind?: "contract" | "amendment"; version?: number },
) {
  const noun = input.kind === "amendment" ? "aditivo" : "contrato";
  const again = (input.version ?? 1) > 1 ? ` Esta é uma nova versão (${input.version}); a anterior deixou de valer.` : "";
  await send({
    to: email,
    tag: "contract",
    subject: `${input.kind === "amendment" ? "Aditivo" : "Contrato"} para assinatura: ${input.title}`,
    text: `A Anuntech enviou o ${noun} "${input.title}" para ${input.companyName}.${again}\n\nLeia e assine pelo Console: ${input.url}\n\nVocê assina com o seu acesso ao Console, que confirma sua identidade pelo e-mail ou WhatsApp cadastrado.\n\nAnuntech`,
  });
}

/** Warns the Anuntech side that a signed contract is about to end, or has ended. */
export async function deliverContractExpiryNotice(
  email: string,
  input: { companyName: string; title: string; url: string; endsAt: string; days: number },
) {
  const expired = input.days < 0;
  const when = expired
    ? input.days === -1
      ? "venceu ontem"
      : `venceu há ${-input.days} dias`
    : input.days === 0
      ? "vence hoje"
      : input.days === 1
        ? "vence amanhã"
        : `vence em ${input.days} dias`;
  await send({
    to: email,
    tag: "contract-expiry",
    subject: `${expired ? "Contrato vencido" : "Contrato vencendo"}: ${input.title}`,
    text: `O contrato "${input.title}" com ${input.companyName} ${when} (${longDateLabel(input.endsAt)}).\n\n${expired ? "Se a relação continua, registre a renovação por aditivo ou crie um novo contrato." : "Para renovar, crie um aditivo de prorrogação ou um novo contrato antes do fim da vigência."}\n\nAbrir no Console: ${input.url}\n\nConsole da Anuntech`,
  });
}
