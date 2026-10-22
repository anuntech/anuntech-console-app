"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { accountEmails, memberships, session, user } from "@/db/schema";
import {
  getAccountSession,
  requireRecentAccountSession,
} from "./account-session";
import type { ActionState } from "../action-state";
import { deleteAccount, startAccountDeletion } from "./account-deletion";
import {
  accountErrorMessage,
  confirmAccountEmailChange,
  renameAccount,
  startAccountEmailChange,
} from "./account-profile";

export type AccountEmailState = ActionState & {
  challengeId?: string;
  email?: string;
  primary?: boolean;
};
const refresh = () => {
  revalidatePath("/conta");
  revalidatePath("/", "layout");
};
const errorMessage = accountErrorMessage;

export async function updateAccountName(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const current = await getAccountSession();
  if (!current) return { error: "Entre novamente para editar seu perfil." };
  const name = form.get("name");
  const result = await renameAccount(current, {
    name: typeof name === "string" ? name : "",
  });
  if ("error" in result) return result;
  refresh();
  return result;
}

export async function requestAccountEmail(
  _: AccountEmailState,
  form: FormData,
): Promise<AccountEmailState> {
  try {
    const current = await requireRecentAccountSession();
    return await startAccountEmailChange(current, {
      email: String(form.get("email") || ""),
      primary: form.get("primary") === "true",
    });
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
    const challengeId = z.uuid().parse(form.get("challengeId"));
    const sourceCode = z
      .string()
      .regex(/^\d{6}$/)
      .parse(form.get("sourceCode"));
    const targetCode = z
      .string()
      .regex(/^\d{6}$/)
      .parse(form.get("targetCode"));
    const result = await confirmAccountEmailChange(current, {
      challengeId,
      sourceCode,
      targetCode,
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

export type AccountDeletionState = ActionState & {
  challengeId?: string;
  destination?: string;
};

export async function requestAccountDeletion(
  _: AccountDeletionState,
  form: FormData,
): Promise<AccountDeletionState> {
  const current = await getAccountSession();
  if (!current) return { error: "Entre novamente para excluir sua conta." };
  const channel = z.enum(["email", "whatsapp"]).safeParse(form.get("channel"));
  if (!channel.success) return { error: "Escolha onde receber o código." };
  try {
    return await startAccountDeletion(current, channel.data);
  } catch {
    return { error: errorMessage(null) };
  }
}

export async function confirmAccountDeletion(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const current = await getAccountSession();
  if (!current) return { error: "Entre novamente para excluir sua conta." };
  const input = z
    .object({
      challengeId: z.uuid(),
      code: z.string().regex(/^\d{6}$/),
      confirmation: z.string().max(40),
    })
    .safeParse({
      challengeId: form.get("challengeId"),
      code: form.get("code"),
      confirmation: form.get("confirmation") ?? "",
    });
  if (!input.success)
    return { error: "Informe o código de 6 números que você recebeu." };
  try {
    const result = await deleteAccount(current, input.data);
    if ("error" in result) return result;
  } catch {
    return { error: errorMessage(null) };
  }
  // The sessions are gone; the browser's cookies go too, so the next page is the sign-in.
  const jar = await cookies();
  for (const { name } of jar.getAll())
    if (name.includes("anuntech-console."))
      jar.set(name, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        secure: name.startsWith("__Secure-"),
      });
  return { success: "Conta excluída.", href: "/entrar?conta=excluida" };
}
