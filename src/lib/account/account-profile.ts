import "server-only";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  accountEmails,
  auditEvents,
  session,
  user,
  verification,
} from "@/db/schema";
import { AccessChangeError } from "../companies/company-management";
import {
  assertSingleEnvironment,
  lockEnvironmentAssignments,
} from "../access/environment-access";
import { deliverEmailOtp, reserveOtp } from "../auth/otp-delivery";

/*
 * The account's own data (name and access e-mail), for the web's server
 * actions (account-actions.ts, which read the FormData and revalidate) and
 * the app's profile.* procedures. The caller has already checked the session
 * (verified e-mail and allowedEmail, as getAccountSession does); these take it
 * and a typed input. Expected refusals come back as { error }; anything else
 * throws, and each caller words it.
 */

type Current = {
  user: { id: string; email: string; twoFactorEnabled?: boolean | null };
  session: { id: string; createdAt: Date | string };
};
type EmailProof = {
  userId: string;
  sessionId: string;
  sourceEmail: string;
  email: string;
  primary: boolean;
  sourceHash: string;
  targetHash: string;
  attempts: number;
};

/** Contact changes need a sign-in less than 10 minutes old (requireRecentAccountSession). */
export const RECENT_SIGN_IN_MS = 600_000;
export const RECENT_SIGN_IN_REFUSAL =
  "Entre novamente para alterar os dados de acesso da sua conta.";
export const isRecentSignIn = (
  current: { createdAt: Date | string },
  now = Date.now(),
) => now - new Date(current.createdAt).getTime() <= RECENT_SIGN_IN_MS;

const hash = (id: string, code: string) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(`account-email:${id}:${code}`)
    .digest("hex");
const matches = (expected: string, actual: string) =>
  expected.length === actual.length &&
  timingSafeEqual(Buffer.from(expected), Buffer.from(actual));

/** The words for an error thrown by these functions (the rest is generic). */
export const accountErrorMessage = (e: unknown) =>
  e instanceof AccessChangeError ||
  (e instanceof Error && e.message.startsWith("Entre novamente"))
    ? e.message
    : "Não foi possível concluir. Confira os dados e tente novamente.";

/** Whether a thrown error is a refusal meant for the person (not a fault). */
export const isAccountRefusal = (e: unknown) => e instanceof AccessChangeError;

export async function renameAccount(
  current: Current,
  input: { name: string },
): Promise<{ error: string } | { success: string }> {
  const parsed = z.string().trim().min(2).max(100).safeParse(input.name);
  if (!parsed.success)
    return { error: "Informe um nome entre 2 e 100 caracteres." };
  await db
    .update(user)
    .set({ name: parsed.data, updatedAt: new Date() })
    .where(eq(user.id, current.user.id));
  return { success: "Nome atualizado." };
}

/** Sends a code to the current address and one to the new; both confirm the change. */
export async function startAccountEmailChange(
  current: Current,
  input: { email: string; primary: boolean },
): Promise<
  { error: string } | { challengeId: string; email: string; primary: boolean }
> {
  if (!isRecentSignIn(current.session)) return { error: RECENT_SIGN_IN_REFUSAL };
  if (current.user.twoFactorEnabled)
    return {
      error:
        "Desative a verificação em duas etapas antes de alterar os contatos de acesso.",
    };
  const parsed = z.email().max(254).safeParse(input.email.trim().toLowerCase());
  if (!parsed.success) return { error: "Informe um e-mail válido." };
  const email = parsed.data;
  if (email === current.user.email)
    return { error: "Este já é seu e-mail principal." };
  const primary = input.primary;
  const [existing] = await db
    .select()
    .from(accountEmails)
    .where(eq(accountEmails.email, email));
  if (existing && existing.userId !== current.user.id)
    return { error: "Este e-mail não está disponível para esta conta." };
  if (existing?.verifiedAt && !primary)
    return { error: "Este e-mail já está na sua conta." };
  const emails = await db
    .select({ id: accountEmails.id })
    .from(accountEmails)
    .where(eq(accountEmails.userId, current.user.id));
  if (!existing && emails.length >= 5)
    return { error: "Sua conta pode ter até 5 e-mails." };
  if (!(await reserveOtp(current.user.email)) || !(await reserveOtp(email)))
    return { error: "Aguarde um minuto antes de solicitar novos códigos." };
  const id = randomUUID();
  const source = String(randomInt(0, 1000000)).padStart(6, "0");
  const target = String(randomInt(0, 1000000)).padStart(6, "0");
  const proof: EmailProof = {
    userId: current.user.id,
    sessionId: current.session.id,
    sourceEmail: current.user.email,
    email,
    primary,
    sourceHash: hash(`${id}:source`, source),
    targetHash: hash(`${id}:target`, target),
    attempts: 0,
  };
  const identifier = `account-email:${id}`;
  await db.insert(verification).values({
    id,
    identifier,
    value: JSON.stringify(proof),
    expiresAt: new Date(Date.now() + 300000),
  });
  try {
    await Promise.all([
      deliverEmailOtp(current.user.email, source),
      deliverEmailOtp(email, target),
    ]);
  } catch {
    await db.delete(verification).where(eq(verification.id, id));
    return {
      error: "Não foi possível enviar os códigos. Aguarde e tente novamente.",
    };
  }
  return { challengeId: id, email, primary };
}

/**
 * Checks both codes and adds the address; as the main e-mail it replaces the
 * account's and ends every session, this one included.
 */
export async function confirmAccountEmailChange(
  current: Current,
  input: { challengeId: string; sourceCode: string; targetCode: string },
): Promise<{ error: string } | { success: string; href?: string }> {
  if (!isRecentSignIn(current.session)) return { error: RECENT_SIGN_IN_REFUSAL };
  const { challengeId: id, sourceCode, targetCode } = input;
  return db.transaction(async (tx) => {
    await lockEnvironmentAssignments(tx);
    const [lockedUser] = await tx
      .select()
      .from(user)
      .where(eq(user.id, current.user.id))
      .for("update");
    const [liveSession] = await tx
      .select({ id: session.id })
      .from(session)
      .where(
        and(
          eq(session.id, current.session.id),
          gt(session.expiresAt, new Date()),
        ),
      );
    if (!liveSession) return { error: RECENT_SIGN_IN_REFUSAL };
    if (!lockedUser || lockedUser.twoFactorEnabled)
      return {
        error:
          "Desative a verificação em duas etapas antes de alterar os contatos.",
      };
    const [record] = await tx
      .select()
      .from(verification)
      .where(
        and(
          eq(verification.id, id),
          eq(verification.identifier, `account-email:${id}`),
        ),
      )
      .for("update");
    if (!record || record.expiresAt < new Date())
      return { error: "Os códigos expiraram. Solicite novos códigos." };
    const proof = JSON.parse(record.value) as EmailProof;
    if (
      proof.userId !== current.user.id ||
      proof.sessionId !== current.session.id ||
      proof.sourceEmail !== lockedUser.email
    )
      return { error: "Esta solicitação não pertence à sua sessão." };
    if (proof.attempts >= 5)
      return {
        error: "Limite de tentativas atingido. Solicite novos códigos.",
      };
    if (
      !matches(proof.sourceHash, hash(`${id}:source`, sourceCode)) ||
      !matches(proof.targetHash, hash(`${id}:target`, targetCode))
    ) {
      await tx
        .update(verification)
        .set({
          value: JSON.stringify({ ...proof, attempts: proof.attempts + 1 }),
        })
        .where(eq(verification.id, id));
      return {
        error: "Confira os dois códigos recebidos. Eles valem por 5 minutos.",
      };
    }
    const contacts = await tx
      .select({ email: accountEmails.email })
      .from(accountEmails)
      .where(eq(accountEmails.userId, current.user.id));
    if (
      contacts.length >= 5 &&
      !contacts.some((contact) => contact.email === proof.email)
    )
      return { error: "Sua conta pode ter até 5 e-mails." };
    await assertSingleEnvironment(tx, [
      ...contacts.map((contact) => contact.email),
      lockedUser.email,
      proof.email,
    ]);
    // The registry has a global unique email constraint, including all primary addresses.
    await tx
      .insert(accountEmails)
      .values({
        userId: current.user.id,
        email: proof.email,
        verifiedAt: new Date(),
      })
      .onConflictDoNothing({ target: accountEmails.email });
    const [owned] = await tx
      .select()
      .from(accountEmails)
      .where(eq(accountEmails.email, proof.email));
    if (owned?.userId !== current.user.id)
      return { error: "Este e-mail não está disponível para esta conta." };
    await tx
      .update(accountEmails)
      .set({ verifiedAt: new Date() })
      .where(eq(accountEmails.id, owned.id));
    if (proof.primary) {
      await tx
        .update(user)
        .set({
          email: proof.email,
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(user.id, current.user.id));
      await tx.delete(session).where(eq(session.userId, current.user.id));
    }
    await tx.delete(verification).where(eq(verification.id, id));
    await tx.insert(auditEvents).values({
      actorId: current.user.id,
      action: proof.primary
        ? "account.email.primary_changed"
        : "account.email.added",
      entityId: current.user.id,
      details: { email: proof.email },
    });
    return proof.primary
      ? {
          success:
            "E-mail principal atualizado. Entre novamente com o novo endereço.",
          href: "/entrar",
        }
      : { success: "E-mail verificado e adicionado." };
  });
}
