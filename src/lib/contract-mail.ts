import "server-only";
import { randomUUID } from "node:crypto";

/** Tells a client contact that a contract awaits their signature in the Console. */
export async function deliverContractNotice(
  email: string,
  input: { companyName: string; title: string; url: string },
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `contract-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: `Contrato para assinatura: ${input.title}`,
      text: `A Anuntech enviou o contrato "${input.title}" para ${input.companyName}.\n\nLeia e assine pelo Console: ${input.url}\n\nA assinatura é feita com o seu acesso ao Console, que confirma sua identidade pelo e-mail ou WhatsApp cadastrado.\n\nAnuntech Console`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.id) throw new Error("Não foi possível enviar o aviso por e-mail.");
}
