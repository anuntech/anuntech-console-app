import "server-only";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import {
  account,
  accountEmails,
  assistantConversations,
  assistantProposals,
  auditEvents,
  bookmarkFolderShares,
  bookmarkFolders,
  bookmarks,
  companies,
  consoleStaffMembers,
  membershipEngagements,
  memberships,
  session,
  ticketUploads,
  twoFactor,
  user,
  userMilestones,
  verification,
} from "@/db/schema";
import { db } from "../db";
import { lockEnvironmentAssignments } from "../access/environment-access";
import {
  deliverEmailOtp,
  deliverWhatsappOtp,
  reserveOtp,
} from "../auth/otp-delivery";
import { maskDestination, type SecurityChannel } from "../auth/security-policy";
import { getAccountEmails } from "./account-identity";
import { deleteProfileAvatar } from "./profile-avatar";
import { sendOpsMail } from "../notifications/ops-alerts";

/** What the person types to confirm, besides the code. */
export const DELETION_WORD = "EXCLUIR";
export const DELETED_NAME = "Conta excluída";
export const deletedEmail = (userId: string) => `excluida+${userId}@invalid`;
export const confirmsDeletion = (typed: string) =>
  typed.trim().toUpperCase() === DELETION_WORD;

type Session = { user: { id: string }; session: { id: string } };
type Proof = {
  userId: string;
  sessionId: string;
  channel: SecurityChannel;
  destination: string;
  codeHash: string;
  attempts: number;
};
export type DeletionResult =
  | { error: string }
  | { deleted: true; previousEmail: string };

const identifier = (id: string) => `account-deletion:${id}`;
const hash = (id: string, code: string) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(`account-deletion:${id}:${code}`)
    .digest("hex");
const matches = (expected: string, actual: string) =>
  expected.length === actual.length &&
  timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
const ownerEmail = () =>
  process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase() || "";
const OWNER_REFUSAL =
  "A conta do proprietário do Console não pode ser excluída. Transfira a administração antes.";

/**
 * Sends a fresh code to a verified contact of the signed-in person. The code
 * and the typed word are the only proof deleteAccount accepts, so a stolen
 * session alone cannot erase the account.
 */
export async function startAccountDeletion(
  current: Session,
  channel: SecurityChannel,
): Promise<{ error: string } | { challengeId: string; destination: string }> {
  const [person] = await db
    .select()
    .from(user)
    .where(eq(user.id, current.user.id));
  if (!person) return { error: "Entre novamente para excluir sua conta." };
  const emails = await getAccountEmails(person.id, person.email);
  if (emails.includes(ownerEmail())) return { error: OWNER_REFUSAL };
  if (channel === "whatsapp" && !(person.phoneNumberVerified && person.phoneNumber))
    return { error: "Vincule um WhatsApp ou receba o código por e-mail." };
  const destination =
    channel === "email" ? person.email : (person.phoneNumber as string);
  if (!(await reserveOtp(destination)))
    return { error: "Aguarde um minuto antes de solicitar outro código." };
  const id = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const proof: Proof = {
    userId: person.id,
    sessionId: current.session.id,
    channel,
    destination,
    codeHash: hash(id, code),
    attempts: 0,
  };
  // One pending request per person: a new code replaces the previous one.
  await db
    .delete(verification)
    .where(
      and(
        sql`${verification.identifier} like 'account-deletion:%'`,
        sql`${verification.value} like ${`%"userId":${JSON.stringify(person.id)}%`}`,
      ),
    );
  await db.insert(verification).values({
    id,
    identifier: identifier(id),
    value: JSON.stringify(proof),
    expiresAt: new Date(Date.now() + 300_000),
  });
  try {
    if (channel === "email") await deliverEmailOtp(destination, code);
    else await deliverWhatsappOtp(destination, code);
  } catch {
    await db.delete(verification).where(eq(verification.id, id));
    return {
      error: "Não foi possível enviar o código. Aguarde e tente novamente.",
    };
  }
  return { challengeId: id, destination: maskDestination(channel, destination) };
}

/**
 * Erases the person and keeps the company's records. The user row stays
 * (tickets, messages, signatures, hours and audit point at it) with the name
 * "Conta excluída" and an address that can never sign in; contacts, sessions,
 * login links, access and personal content go. Signatures keep the snapshot
 * taken when the contract was signed, as the law asks.
 */
export async function deleteAccount(
  current: Session,
  input: { challengeId: string; code: string; confirmation: string },
): Promise<DeletionResult> {
  if (!confirmsDeletion(input.confirmation))
    return { error: `Digite ${DELETION_WORD} para confirmar.` };
  const result = await db.transaction(async (tx) => {
    // Same order as invitations and contact changes: the environment lock, then the person.
    await lockEnvironmentAssignments(tx);
    const [person] = await tx
      .select()
      .from(user)
      .where(eq(user.id, current.user.id))
      .for("update");
    const [live] = await tx
      .select({ id: session.id })
      .from(session)
      .where(
        and(
          eq(session.id, current.session.id),
          gt(session.expiresAt, new Date()),
        ),
      );
    if (!person || !live)
      return { error: "Entre novamente para excluir sua conta." } as const;
    const [record] = await tx
      .select()
      .from(verification)
      .where(
        and(
          eq(verification.id, input.challengeId),
          eq(verification.identifier, identifier(input.challengeId)),
        ),
      )
      .for("update");
    if (!record || record.expiresAt <= new Date())
      return { error: "O código expirou. Solicite um novo código." } as const;
    const proof = JSON.parse(record.value) as Proof;
    if (proof.userId !== person.id || proof.sessionId !== live.id)
      return { error: "Esta solicitação não pertence à sua sessão." } as const;
    const contact =
      proof.channel === "email" ? person.email : person.phoneNumber;
    if (contact !== proof.destination)
      return { error: "Seus contatos mudaram. Solicite um novo código." } as const;
    if (proof.attempts >= 3)
      return {
        error: "Limite de tentativas atingido. Solicite um novo código.",
      } as const;
    if (!matches(proof.codeHash, hash(input.challengeId, input.code))) {
      await tx
        .update(verification)
        .set({ value: JSON.stringify({ ...proof, attempts: proof.attempts + 1 }) })
        .where(eq(verification.id, record.id));
      return {
        error: "Código inválido. Confira o código recebido, ele vale por 5 minutos.",
      } as const;
    }
    const emails = await getAccountEmails(person.id, person.email, tx);
    if (emails.includes(ownerEmail())) return { error: OWNER_REFUSAL } as const;

    // Access: every grant of every address of the account ends here.
    const grants = await tx
      .select({
        id: memberships.id,
        companyId: memberships.companyId,
        role: memberships.role,
      })
      .from(memberships)
      .where(
        and(inArray(memberships.email, emails), eq(memberships.active, true)),
      );
    const managed = [
      ...new Set(
        grants.filter((g) => g.role === "manager").map((g) => g.companyId),
      ),
    ];
    const others = managed.length
      ? await tx
          .select({ companyId: memberships.companyId })
          .from(memberships)
          .where(
            and(
              inArray(memberships.companyId, managed),
              notInArray(memberships.email, emails),
              eq(memberships.role, "manager"),
              eq(memberships.active, true),
            ),
          )
      : [];
    const orphaned = managed.filter(
      (id) => !others.some((other) => other.companyId === id),
    );
    if (grants.length) {
      await tx
        .update(memberships)
        .set({ active: false, engagementAccess: "all" })
        .where(
          inArray(
            memberships.id,
            grants.map((g) => g.id),
          ),
        );
      await tx.delete(membershipEngagements).where(
        inArray(
          membershipEngagements.membershipId,
          grants.map((g) => g.id),
        ),
      );
    }
    const staff = await tx
      .update(consoleStaffMembers)
      .set({ active: false, updatedBy: person.id, updatedAt: new Date() })
      .where(
        and(
          inArray(consoleStaffMembers.email, emails),
          eq(consoleStaffMembers.active, true),
        ),
      )
      .returning({ id: consoleStaffMembers.id });

    // Personal content and every way back in.
    await tx.delete(session).where(eq(session.userId, person.id));
    await tx.delete(account).where(eq(account.userId, person.id));
    await tx.delete(twoFactor).where(eq(twoFactor.userId, person.id));
    await tx.delete(accountEmails).where(eq(accountEmails.userId, person.id));
    await tx.delete(assistantProposals).where(eq(assistantProposals.userId, person.id));
    await tx
      .delete(assistantConversations)
      .where(eq(assistantConversations.userId, person.id));
    await tx.delete(userMilestones).where(eq(userMilestones.userId, person.id));
    await tx.delete(ticketUploads).where(eq(ticketUploads.authorId, person.id));
    await tx
      .delete(bookmarkFolderShares)
      .where(eq(bookmarkFolderShares.userId, person.id));
    // A folder only the person could see goes with its links; shared ones stay with the company.
    const privateFolders = await tx
      .select({ id: bookmarkFolders.id })
      .from(bookmarkFolders)
      .where(
        and(
          eq(bookmarkFolders.ownerId, person.id),
          eq(bookmarkFolders.visibility, "people"),
          sql`not exists (select 1 from ${bookmarkFolderShares} where ${bookmarkFolderShares.folderId} = ${bookmarkFolders.id})`,
        ),
      );
    if (privateFolders.length) {
      const ids = privateFolders.map((f) => f.id);
      await tx.delete(bookmarks).where(inArray(bookmarks.folderId, ids));
      await tx.delete(bookmarkFolders).where(inArray(bookmarkFolders.id, ids));
    }
    await tx
      .delete(verification)
      .where(
        and(
          sql`${verification.identifier} like 'account-deletion:%'`,
          sql`${verification.value} like ${`%"userId":${JSON.stringify(person.id)}%`}`,
        ),
      );
    // The contacts trigger refuses changes while two-step is on, so it goes off first.
    await tx
      .update(user)
      .set({ twoFactorEnabled: false })
      .where(eq(user.id, person.id));
    // The registry trigger reserves the new address, unverified, in account_emails.
    await tx
      .update(user)
      .set({
        name: DELETED_NAME,
        email: deletedEmail(person.id),
        emailVerified: false,
        phoneNumber: null,
        phoneNumberVerified: false,
        image: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, person.id));
    await tx.insert(auditEvents).values({
      actorId: person.id,
      entityId: person.id,
      action: "account.deleted",
      details: {
        channel: proof.channel,
        companies: [...new Set(grants.map((g) => g.companyId))],
        withoutManager: orphaned,
        staff: staff.length > 0,
      },
    });
    const orphanNames = orphaned.length
      ? await tx
          .select({ name: companies.name })
          .from(companies)
          .where(inArray(companies.id, orphaned))
      : [];
    return {
      deleted: true,
      previousEmail: person.email,
      image: person.image,
      orphanNames: orphanNames.map((c) => c.name),
    } as const;
  });
  if ("error" in result) return result;
  // Outside the transaction and best effort: the account is already gone.
  if (result.image)
    await deleteProfileAvatar(result.image, current.user.id).catch(() => {});
  await sendDeletionNotice(result.previousEmail).catch(() => {});
  if (result.orphanNames.length)
    await sendOpsMail(
      "Empresa sem Administrador após exclusão de conta",
      `Uma pessoa excluiu a própria conta no Console e era a única Administradora de: ${result.orphanNames.join(", ")}.\n\nConvide outra pessoa como Administradora em Empresas > Pessoas.`,
    ).catch(() => {});
  return { deleted: true, previousEmail: result.previousEmail };
}

async function sendDeletionNotice(email: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `account-deleted-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Sua conta no Console da Anuntech foi excluída",
      text: `Sua conta no Console da Anuntech foi excluída a seu pedido.\n\nApagamos seu nome, e-mails, telefone, foto, sessões e conversas com o assistente. Os registros da empresa em que você participou (chamados, assinaturas de contrato, horas e faturas) continuam com o autor "Conta excluída", como a lei exige.\n\nSe não foi você, responda este e-mail.\n\nAnuntech`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("Não foi possível enviar o aviso de exclusão.");
}
