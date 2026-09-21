"use server";
import { AccessChangeError } from "./company-management";
import {
  assertSingleEnvironment,
  lockEnvironmentAssignments,
} from "./environment-access";

import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  accountEmails,
  auditEvents,
  memberships,
  session,
  user,
  verification,
} from "@/db/schema";
import {
  getAccountSession,
  requireRecentAccountSession,
} from "./account-session";
import { deliverEmailOtp, reserveOtp } from "./otp-delivery";
import type { ActionState } from "./action-state";

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
export type AccountEmailState = ActionState & {
  challengeId?: string;
  email?: string;
  primary?: boolean;
};
const hash = (id: string, code: string) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(`account-email:${id}:${code}`)
    .digest("hex");
const matches = (expected: string, actual: string) =>
  expected.length === actual.length &&
  timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
const refresh = () => {
  revalidatePath("/conta");
  revalidatePath("/", "layout");
};
const errorMessage = (e: unknown) =>
  e instanceof AccessChangeError ||
  (e instanceof Error && e.message.startsWith("Entre novamente"))
    ? e.message
    : "Não foi possível concluir. Confira os dados e tente novamente.";

export async function updateAccountName(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const current = await getAccountSession();
  if (!current) return { error: "Entre novamente para editar seu perfil." };
  const parsed = z.string().trim().min(2).max(100).safeParse(form.get("name"));
  if (!parsed.success)
    return { error: "Informe um nome entre 2 e 100 caracteres." };
  await db
    .update(user)
    .set({ name: parsed.data, updatedAt: new Date() })
    .where(eq(user.id, current.user.id));
  refresh();
  return { success: "Nome atualizado." };
}

export async function requestAccountEmail(
  _: AccountEmailState,
  form: FormData,
): Promise<AccountEmailState> {
  try {
    const current = await requireRecentAccountSession();
    if (current.user.twoFactorEnabled)
      return {
        error:
          "Desative a verificação em duas etapas antes de alterar os contatos de acesso.",
      };
    const parsed = z
      .email()
      .max(254)
      .safeParse(
        String(form.get("email") || "")
          .trim()
          .toLowerCase(),
      );
    if (!parsed.success) return { error: "Informe um e-mail válido." };
    const email = parsed.data;
    if (email === current.user.email)
      return { error: "Este já é seu e-mail principal." };
    const primary = form.get("primary") === "true";
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
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function confirmAccountEmail(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const current = await requireRecentAccountSession();
    const id = z.uuid().parse(form.get("challengeId"));
    const sourceCode = z
      .string()
      .regex(/^\d{6}$/)
      .parse(form.get("sourceCode"));
    const targetCode = z
      .string()
      .regex(/^\d{6}$/)
      .parse(form.get("targetCode"));
    const result = await db.transaction(async (tx) => {
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
      if (!liveSession)
        return {
          error:
            "Entre novamente para alterar os dados de acesso da sua conta.",
        };
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
    refresh();
    return result;
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function removeAccountEmail(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const current = await requireRecentAccountSession();
    const id = z.uuid().parse(form.get("id"));
    const result = await db.transaction(async (tx) => {
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
      if (!liveSession)
        return {
          error:
            "Entre novamente para alterar os dados de acesso da sua conta.",
        };
      if (!lockedUser || lockedUser.twoFactorEnabled)
        return {
          error:
            "Desative a verificação em duas etapas antes de alterar os contatos.",
        };
      const [email] = await tx
        .select()
        .from(accountEmails)
        .where(
          and(
            eq(accountEmails.id, id),
            eq(accountEmails.userId, current.user.id),
          ),
        )
        .for("update");
      if (!email || email.email === lockedUser.email)
        return { error: "O e-mail principal não pode ser removido." };
      if (email.email === process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase())
        return {
          error:
            "Este e-mail identifica o proprietário do Console e precisa permanecer na conta.",
        };
      // Preserve historical grants and their role semantics. A member can change their
      // primary email without silently dropping access by deleting its old identity.
      const grants = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.email, email.email))
        .limit(1);
      const staff = await tx.execute(
        sql`select id from console_staff_members where email=${email.email} limit 1`,
      );
      if (grants.length || staff.rows.length)
        return {
          error:
            "Este e-mail identifica permissões ou registros de acesso anteriores e precisa permanecer na conta para preservar o histórico.",
        };
      await tx.delete(accountEmails).where(eq(accountEmails.id, id));
      await tx
        .delete(session)
        .where(
          and(
            eq(session.userId, current.user.id),
            ne(session.id, current.session.id),
          ),
        );
      return { success: "E-mail removido." };
    });
    refresh();
    return result;
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
