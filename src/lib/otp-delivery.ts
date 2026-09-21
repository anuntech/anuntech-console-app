import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { memberships } from "@/db/schema";
import { normalizeEmail } from "./permissions";
import { resolveAccountIdentity } from "./account-identity";
import { getConsoleStaffAccess } from "./console-members";
export async function allowedEmail(email: string) {
  email = normalizeEmail(email);
  const identity = await resolveAccountIdentity(email);
  if (identity.isAlias) return false;
  if ((await getConsoleStaffAccess(email)).admin) return true;
  return (
    (
      await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            inArray(memberships.email, identity.emails),
            eq(memberships.active, true),
          ),
        )
        .limit(1)
    ).length > 0
  );
}
// Atomic per-recipient throttle, shared across all Vercel instances.
export async function reserveOtp(destination: string) {
  const key = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(`otp:${destination}`)
    .digest("hex");
  const result = await db.execute(sql`
    INSERT INTO console_otp_limits (key,last_sent_at,window_start,count) VALUES (${key},now(),now(),1)
    ON CONFLICT (key) DO UPDATE SET last_sent_at=now(),
      window_start=CASE WHEN console_otp_limits.window_start < now()-interval '15 minutes' THEN now() ELSE console_otp_limits.window_start END,
      count=CASE WHEN console_otp_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE console_otp_limits.count+1 END
    WHERE console_otp_limits.last_sent_at < now()-interval '60 seconds'
      AND (console_otp_limits.window_start < now()-interval '15 minutes' OR console_otp_limits.count < 5)
    RETURNING key`);
  return result.rows.length > 0;
}
export async function deliverEmailOtp(email: string, otp: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `login-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Seu código de acesso à Anuntech Console",
      text: `Seu código de acesso é: ${otp}\n\nEle expira em 5 minutos e só pode ser usado uma vez.\n\nSe você não solicitou este acesso, ignore esta mensagem. Não compartilhe o código.\n\nAnuntech Console`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.id)
    throw new Error("Não foi possível enviar o código por e-mail.");
}
export async function deliverInviteEmail(
  email: string,
  scope: { kind: "console" } | { kind: "company"; companyName: string },
) {
  const loginUrl = `${process.env.BETTER_AUTH_URL || "http://localhost:3100"}/entrar`;
  const accessLine =
    scope.kind === "console"
      ? "Você agora tem acesso de administrador ao ambiente Anuntech."
      : `Você agora tem acesso à empresa ${scope.companyName} na Anuntech Console.`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `invite-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Você ganhou acesso à Anuntech Console",
      text: `${accessLine}\n\nPara entrar, acesse ${loginUrl} e informe este e-mail (${email}). Você vai receber um código de acesso por e-mail para confirmar o login.\n\nSe você não esperava este e-mail, ignore esta mensagem.\n\nAnuntech Console`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.id)
    throw new Error("Não foi possível enviar o e-mail de convite.");
}
export async function deliverWhatsappOtp(phoneNumber: string, code: string) {
  if (
    !process.env.FLW_OTP_TEMPLATE_ID ||
    !process.env.FLW_SENDER_NUMBER ||
    !process.env.FLW_SYNOVA
  )
    throw new Error("WhatsApp não configurado.");
  const res = await fetch("https://api.wts.chat/chat/v1/send/otp", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${process.env.FLW_SYNOVA.replace(/^Bearer\s+/i, "")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.FLW_SENDER_NUMBER,
      to: phoneNumber.replace(/^\+/, ""),
      code,
      templateId: process.env.FLW_OTP_TEMPLATE_ID,
      senderId: randomUUID(),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.id || result.status === "FAILED")
    throw new Error("Não foi possível enviar o código por WhatsApp.");
}
