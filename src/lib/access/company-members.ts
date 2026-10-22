import "server-only";
import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  accountEmails,
  auditEvents,
  automationEvents,
  companies,
  engagements,
  membershipEngagements,
  memberships,
  user,
} from "@/db/schema";
import type { Actor } from "./access";
import { resolveAccountIdentity } from "../account/account-identity";
import { db } from "../db";
import { deliverInviteEmail } from "../auth/otp-delivery";
import { AccessChangeError, lockManagedCompany } from "../companies/company-management";
import { assertSingleEnvironment, lockEnvironmentAssignments } from "./environment-access";
import { recordInvite } from "./invite-tracking";
import { normalizeEmail } from "./permissions";
import { canManageMembers, managedCompanyIds } from "./member-access";

/*
 * Who enters a company's Console and what they see: invite, change the role
 * or the scope, revoke and resend the invite. The web's server actions
 * (members-actions.ts) and the app's API call these with the actor; the
 * company is locked and the manager grant re-checked inside the transaction.
 */

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** What a change returns; `companyId` tells the web which pages to refresh. */
export type MemberResult = { error: string } | { success: string; companyId?: string };

export const memberEmailInput = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .max(254)
  .transform(normalizeEmail);
export const memberIdInput = z.string().uuid("Acesso inválido.");
const blocked = { error: "Você não tem permissão para fazer isso." };

export function memberFailure(error: unknown): { error: string } {
  return {
    error:
      error instanceof z.ZodError
        ? error.issues[0].message
        : error instanceof AccessChangeError
          ? error.message
          : "Não foi possível atualizar o acesso. Tente novamente.",
  };
}

/** Serialize permission edits with email changes and re-read verified aliases under the user lock. */
export async function lockedIdentity(tx: Transaction, email: string) {
  const identity = await resolveAccountIdentity(email, tx);
  if (!identity.userId) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`console-member:${identity.primaryEmail}`}))`,
    );
    return identity;
  }
  const [account] = await tx
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, identity.userId))
    .for("update");
  if (!account)
    throw new AccessChangeError(
      "A conta mudou. Atualize a página e tente novamente.",
    );
  const aliases = await tx
    .select({ email: accountEmails.email })
    .from(accountEmails)
    .where(
      and(
        eq(accountEmails.userId, identity.userId),
        isNotNull(accountEmails.verifiedAt),
      ),
    );
  const primaryEmail = normalizeEmail(account.email);
  return {
    ...identity,
    primaryEmail,
    emails: [
      ...new Set([
        primaryEmail,
        ...aliases.map((alias) => normalizeEmail(alias.email)),
      ]),
    ],
  };
}

async function protectCompanyAdministration(
  tx: Transaction,
  actor: Actor,
  companyId: string,
  identity: Awaited<ReturnType<typeof lockedIdentity>>,
  nextRole: "manager" | "member" | null,
) {
  if (nextRole === "manager") return;
  if (!actor.admin && identity.userId === actor.user.id)
    throw new AccessChangeError(
      "Você não pode revogar ou reduzir seu próprio acesso de administrador.",
    );
  const [currentManager] = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.companyId, companyId),
        inArray(memberships.email, identity.emails),
        eq(memberships.role, "manager"),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  if (!currentManager) return;
  const [otherManager] = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.companyId, companyId),
        notInArray(memberships.email, identity.emails),
        eq(memberships.role, "manager"),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  if (!otherManager)
    throw new AccessChangeError(
      "Mantenha pelo menos um administrador nesta empresa. Adicione outro antes de alterar este acesso.",
    );
}

/**
 * What the saved membership sees: an Administrador everything; a Membro what the
 * form chose (checked against the company's own products, services and projects)
 * or, with no choice sent, what their active access already had.
 */
async function memberScope(
  tx: Transaction,
  input: { companyId: string; role: "manager" | "member" },
  choice: { engagementAccess: "all" | "selected"; engagementIds: string[] } | null,
  previous: { id: string; role: "manager" | "member"; engagementAccess: "all" | "selected" }[],
): Promise<{ access: "all" | "selected"; ids: string[] }> {
  if (input.role === "manager") return { access: "all", ids: [] };
  if (choice) {
    if (choice.engagementAccess === "all") return { access: "all", ids: [] };
    const found = choice.engagementIds.length
      ? await tx
          .select({ id: engagements.id })
          .from(engagements)
          .where(and(eq(engagements.companyId, input.companyId), inArray(engagements.id, choice.engagementIds)))
      : [];
    if (found.length !== choice.engagementIds.length)
      throw new AccessChangeError("Um dos itens escolhidos não é desta empresa. Atualize a página e tente novamente.");
    return { access: "selected", ids: found.map((row) => row.id) };
  }
  const restricted = previous.filter((p) => p.role === "member" && p.engagementAccess === "selected");
  if (!previous.length || restricted.length < previous.length) return { access: "all", ids: [] };
  const rows = await tx
    .select({ engagementId: membershipEngagements.engagementId })
    .from(membershipEngagements)
    .where(inArray(membershipEngagements.membershipId, restricted.map((p) => p.id)));
  return { access: "selected", ids: [...new Set(rows.map((row) => row.engagementId))] };
}

export type CompanyMemberInput = {
  companyId: string;
  email: string;
  role: string;
  /**
   * What a Membro sees. Only an explicit choice changes it: forms and tools that do
   * not send it (the assistant's invite, a role edit) keep what the person had.
   */
  scope?: { access: string; ids: string[] } | null;
};

/** Invites a person to the company, or changes their role or what they see. */
export async function saveMember(actor: Actor, raw: CompanyMemberInput): Promise<MemberResult> {
  if (!canManageMembers(actor)) return blocked;
  try {
    const input = z
      .object({
        companyId: memberIdInput,
        email: memberEmailInput,
        role: z.enum(["manager", "member"]),
      })
      .parse(raw);
    const scopeChoice = raw.scope
      ? z
          .object({
            engagementAccess: z.enum(["all", "selected"]),
            engagementIds: z.array(z.string().uuid("Produto inválido.")).max(500),
          })
          .parse({ engagementAccess: raw.scope.access, engagementIds: [...new Set(raw.scope.ids.map(String))] })
      : null;
    const isNewAccess = await db.transaction(async (tx) => {
      await lockEnvironmentAssignments(tx);
      await lockManagedCompany(tx, actor, input.companyId);
      const identity = await lockedIdentity(tx, input.email);
      await assertSingleEnvironment(tx, identity.emails, input.companyId);
      await protectCompanyAdministration(
        tx,
        actor,
        input.companyId,
        identity,
        input.role,
      );
      const previous = await tx
        .select({
          id: memberships.id,
          email: memberships.email,
          role: memberships.role,
          engagementAccess: memberships.engagementAccess,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.companyId, input.companyId),
            inArray(memberships.email, identity.emails),
            eq(memberships.active, true),
          ),
        );
      // One effective role per company, even when the account has older verified emails.
      await tx
        .update(memberships)
        .set({ active: false })
        .where(
          and(
            eq(memberships.companyId, input.companyId),
            inArray(memberships.email, identity.emails),
            eq(memberships.active, true),
          ),
        );
      const scope = await memberScope(tx, input, scopeChoice, previous);
      const [member] = await tx
        .insert(memberships)
        .values({ ...input, email: identity.primaryEmail, engagementAccess: scope.access })
        .onConflictDoUpdate({
          target: [memberships.companyId, memberships.email],
          set: { role: input.role, active: true, engagementAccess: scope.access },
        })
        .returning();
      // The selection lives on the active row; a row reactivated later never brings an old one back.
      const touched = [...new Set([member.id, ...previous.map((p) => p.id)])];
      await tx.delete(membershipEngagements).where(inArray(membershipEngagements.membershipId, touched));
      if (scope.access === "selected" && scope.ids.length)
        await tx.insert(membershipEngagements).values(scope.ids.map((engagementId) => ({ membershipId: member.id, engagementId })));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: input.companyId,
        action: "membership.granted",
        entityId: member.id,
        details: {
          email: identity.primaryEmail,
          role: input.role,
          engagementAccess: scope.access,
          ...(scope.access === "selected" ? { engagementIds: scope.ids } : {}),
          previous,
        },
      });
      return previous.length === 0;
    });
    if (isNewAccess) {
      try {
        const [company] = await db
          .select({ name: companies.name })
          .from(companies)
          .where(eq(companies.id, input.companyId));
        const sent = await deliverInviteEmail(input.email, {
          kind: "company",
          companyName: company?.name || "sua empresa",
        });
        const [member] = await db
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.companyId, input.companyId), eq(memberships.email, input.email), eq(memberships.active, true)));
        if (member) await recordInvite(sent, { membershipId: member.id, companyId: input.companyId, email: input.email });
      } catch {
        return {
          success:
            "Acesso liberado, mas não foi possível enviar o e-mail de convite. Avise a pessoa manualmente.",
          companyId: input.companyId,
        };
      }
    }
    return {
      success: isNewAccess
        ? "Acesso liberado. Um e-mail de convite foi enviado."
        : "Acesso atualizado. A pessoa já tinha acesso a esta empresa.",
      companyId: input.companyId,
    };
  } catch (error) {
    return memberFailure(error);
  }
}

/** Removes a person's access to the company (every alias), or cancels the invite. */
export async function revokeMember(actor: Actor, raw: { membershipId: string }): Promise<MemberResult> {
  if (!canManageMembers(actor)) return blocked;
  try {
    const id = memberIdInput.parse(raw.membershipId);
    const companyId = await db.transaction(async (tx) => {
      await lockEnvironmentAssignments(tx);
      const [entry] = await tx
        .select({ email: memberships.email, companyId: memberships.companyId })
        .from(memberships)
        .where(
          and(
            eq(memberships.id, id),
            actor.admin
              ? undefined
              : inArray(memberships.companyId, managedCompanyIds(actor)),
          ),
        );
      if (!entry) throw new AccessChangeError(blocked.error);
      await lockManagedCompany(tx, actor, entry.companyId);
      const identity = await lockedIdentity(tx, entry.email);
      await protectCompanyAdministration(
        tx,
        actor,
        entry.companyId,
        identity,
        null,
      );
      // A later invitation starts from "everything" again, with no selection left behind.
      const changed = await tx
        .update(memberships)
        .set({ active: false, engagementAccess: "all" })
        .where(
          and(
            eq(memberships.companyId, entry.companyId),
            inArray(memberships.email, identity.emails),
            eq(memberships.active, true),
          ),
        )
        .returning({ id: memberships.id, email: memberships.email });
      if (changed.length)
        await tx.delete(membershipEngagements).where(inArray(membershipEngagements.membershipId, changed.map((m) => m.id)));
      for (const member of changed)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: entry.companyId,
          action: "membership.revoked",
          entityId: member.id,
          details: { email: member.email },
        });
      return entry.companyId;
    });
    return {
      success: "Acesso à empresa revogado. Outros vínculos foram preservados.",
      companyId,
    };
  } catch (error) {
    return memberFailure(error);
  }
}

/**
 * Sends the invite again to someone who never signed in: the team or the
 * company's Administrador, at most once a week per access.
 */
export async function resendMemberInvite(actor: Actor, raw: { membershipId: string }): Promise<MemberResult> {
  if (!canManageMembers(actor)) return blocked;
  try {
    const id = memberIdInput.parse(raw.membershipId);
    const [entry] = await db
      .select({ id: memberships.id, email: memberships.email, companyId: memberships.companyId, company: companies.name })
      .from(memberships)
      .innerJoin(companies, eq(companies.id, memberships.companyId))
      .where(
        and(
          eq(memberships.id, id),
          eq(memberships.active, true),
          actor.admin ? undefined : inArray(memberships.companyId, managedCompanyIds(actor)),
        ),
      );
    if (!entry) return blocked;
    const monday = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    })();
    const [claimed] = await db
      .insert(automationEvents)
      .values({ kind: "invite.resend", entityId: `${entry.id}:${monday}`, companyId: entry.companyId, actorId: actor.user.id })
      .onConflictDoNothing()
      .returning({ id: automationEvents.id });
    if (!claimed) return { error: "O convite já foi reenviado esta semana. Confira o e-mail com a pessoa." };
    try {
      const sent = await deliverInviteEmail(entry.email, { kind: "company", companyName: entry.company });
      await recordInvite(sent, { membershipId: entry.id, companyId: entry.companyId, email: entry.email });
    } catch {
      await db.delete(automationEvents).where(eq(automationEvents.id, claimed.id));
      return { error: "Não foi possível reenviar o convite agora. Tente de novo em instantes." };
    }
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: entry.companyId, entityId: entry.id, action: "membership.invite_resent", details: { email: entry.email } });
    return { success: `Convite reenviado para ${entry.email}.` };
  } catch (e) {
    return memberFailure(e);
  }
}
