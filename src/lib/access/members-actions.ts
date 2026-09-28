"use server";
import {
  assertSingleEnvironment,
  lockEnvironmentAssignments,
} from "./environment-access";
import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  accountEmails,
  auditEvents,
  companies,
  consoleStaffMembers,
  memberships,
  user,
} from "@/db/schema";
import { getActor, type Actor } from "./access";
import { resolveAccountIdentity } from "../account/account-identity";
import type { ActionState } from "../action-state";
import { getConsoleStaffAccess } from "./console-members";
import { db } from "../db";
import { deliverInviteEmail } from "../auth/otp-delivery";
import { normalizeEmail } from "./permissions";
import { canManageMembers, managedCompanyIds } from "./member-access";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const emailInput = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .max(254)
  .transform(normalizeEmail);
const idInput = z.string().uuid("Acesso inválido.");
const blocked = { error: "Você não tem permissão para fazer isso." };
import { AccessChangeError, lockManagedCompany } from "../companies/company-management";

function failure(error: unknown): ActionState {
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
async function lockedIdentity(tx: Transaction, email: string) {
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

function ownsConsole(emails: string[]) {
  const configured = process.env.CONSOLE_ADMIN_EMAIL?.trim();
  return !!configured && emails.includes(normalizeEmail(configured));
}

function refreshMembers(companyId?: string) {
  revalidatePath("/configuracoes/membros");
  revalidatePath("/", "layout");
  if (companyId) revalidatePath(`/empresas/${companyId}`);
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

export async function saveConsoleStaffMember(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin || !(await getConsoleStaffAccess(actor.user.email)).owner)
    return blocked;
  try {
    const email = emailInput.parse(form.get("email"));
    const changed = await db.transaction(async (tx) => {
      await lockEnvironmentAssignments(tx);
      const identity = await lockedIdentity(tx, email);
      await assertSingleEnvironment(tx, identity.emails, "console");
      if (ownsConsole(identity.emails))
        throw new AccessChangeError(
          "O proprietário já administra o Console e não perde esse acesso.",
        );
      const [existing] = await tx
        .select({ id: consoleStaffMembers.id })
        .from(consoleStaffMembers)
        .where(
          and(
            inArray(consoleStaffMembers.email, identity.emails),
            eq(consoleStaffMembers.active, true),
          ),
        )
        .limit(1);
      if (existing) return false;
      const [member] = await tx
        .insert(consoleStaffMembers)
        .values({
          email: identity.primaryEmail,
          createdBy: actor.user.id,
          updatedBy: actor.user.id,
        })
        .onConflictDoUpdate({
          target: consoleStaffMembers.email,
          set: {
            active: true,
            updatedBy: actor.user.id,
            updatedAt: new Date(),
          },
        })
        .returning();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        action: "staff.granted",
        entityId: member.id,
        details: { email: identity.primaryEmail },
      });
      return true;
    });
    refreshMembers();
    if (changed) {
      try {
        await deliverInviteEmail(email, { kind: "console" });
      } catch {
        return {
          success:
            "Administração liberada, mas não foi possível enviar o e-mail de convite. Avise a pessoa manualmente.",
        };
      }
    }
    return {
      success: changed
        ? "Administração liberada. Um e-mail de convite foi enviado."
        : "Esta pessoa já administra o Console.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeConsoleStaffMember(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin || !(await getConsoleStaffAccess(actor.user.email)).owner)
    return blocked;
  try {
    const id = idInput.parse(form.get("id"));
    await db.transaction(async (tx) => {
      await lockEnvironmentAssignments(tx);
      const [entry] = await tx
        .select({ email: consoleStaffMembers.email })
        .from(consoleStaffMembers)
        .where(eq(consoleStaffMembers.id, id));
      if (!entry)
        throw new AccessChangeError("Este acesso não foi encontrado.");
      const identity = await lockedIdentity(tx, entry.email);
      if (ownsConsole(identity.emails))
        throw new AccessChangeError(
          "O acesso do proprietário não pode ser revogado.",
        );
      const changed = await tx
        .update(consoleStaffMembers)
        .set({ active: false, updatedBy: actor.user.id, updatedAt: new Date() })
        .where(
          and(
            inArray(consoleStaffMembers.email, identity.emails),
            eq(consoleStaffMembers.active, true),
          ),
        )
        .returning({
          id: consoleStaffMembers.id,
          email: consoleStaffMembers.email,
        });
      for (const member of changed)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          action: "staff.revoked",
          entityId: member.id,
          details: { email: member.email },
        });
    });
    refreshMembers();
    return {
      success:
        "Administração revogada. Os vínculos específicos com empresas foram preservados.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function saveCompanyMember(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!canManageMembers(actor)) return blocked;
  try {
    const input = z
      .object({
        companyId: idInput,
        email: emailInput,
        role: z.enum(["manager", "member"]),
      })
      .parse(Object.fromEntries(form));
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
      const [member] = await tx
        .insert(memberships)
        .values({ ...input, email: identity.primaryEmail })
        .onConflictDoUpdate({
          target: [memberships.companyId, memberships.email],
          set: { role: input.role, active: true },
        })
        .returning();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: input.companyId,
        action: "membership.granted",
        entityId: member.id,
        details: { email: identity.primaryEmail, role: input.role, previous },
      });
      return previous.length === 0;
    });
    refreshMembers(input.companyId);
    if (isNewAccess) {
      try {
        const [company] = await db
          .select({ name: companies.name })
          .from(companies)
          .where(eq(companies.id, input.companyId));
        await deliverInviteEmail(input.email, {
          kind: "company",
          companyName: company?.name || "sua empresa",
        });
      } catch {
        return {
          success:
            "Acesso liberado, mas não foi possível enviar o e-mail de convite. Avise a pessoa manualmente.",
        };
      }
    }
    return {
      success: isNewAccess
        ? "Acesso liberado. Um e-mail de convite foi enviado."
        : "Acesso atualizado. A pessoa já tinha acesso a esta empresa.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeCompanyMember(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!canManageMembers(actor)) return blocked;
  try {
    const id = idInput.parse(form.get("id"));
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
      const changed = await tx
        .update(memberships)
        .set({ active: false })
        .where(
          and(
            eq(memberships.companyId, entry.companyId),
            inArray(memberships.email, identity.emails),
            eq(memberships.active, true),
          ),
        )
        .returning({ id: memberships.id, email: memberships.email });
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
    refreshMembers(companyId);
    return {
      success: "Acesso à empresa revogado. Outros vínculos foram preservados.",
    };
  } catch (error) {
    return failure(error);
  }
}
