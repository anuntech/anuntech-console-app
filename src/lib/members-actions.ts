"use server";
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
import { getAccountEmails, resolveAccountIdentity } from "./account-identity";
import type { ActionState } from "./action-state";
import { getConsoleStaffAccess } from "./console-members";
import { db } from "./db";
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
const blocked = { error: "Você não tem permissão para realizar esta ação." };
class AccessChangeError extends Error {}

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

/** A company lock serializes grants, demotions and revocations before authorization. */
async function lockManagedCompany(
  tx: Transaction,
  actor: Actor,
  companyId: string,
) {
  const [company] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.id, companyId),
        actor.admin
          ? undefined
          : inArray(companies.id, managedCompanyIds(actor)),
      ),
    )
    .for("update");
  if (!company) throw new AccessChangeError(blocked.error);
  if (actor.admin) return;
  // A form opened before a revocation cannot keep using the old manager grant.
  const emails = await getAccountEmails(actor.user.id, actor.user.email, tx);
  const [manager] = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.companyId, companyId),
        inArray(memberships.email, emails),
        eq(memberships.role, "manager"),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  if (!manager) throw new AccessChangeError(blocked.error);
}

async function protectCompanyAdministration(
  tx: Transaction,
  actor: Actor,
  companyId: string,
  identity: Awaited<ReturnType<typeof lockedIdentity>>,
  nextRole: "manager" | "support" | "finance" | null,
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
      const identity = await lockedIdentity(tx, email);
      if (ownsConsole(identity.emails))
        throw new AccessChangeError(
          "O proprietário já possui administração permanente do Console.",
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
    return {
      success: changed
        ? "Administração liberada. Nenhuma mensagem foi enviada."
        : "Esta pessoa já possui administração do Console.",
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
        role: z.enum(["manager", "support", "finance"]),
      })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      await lockManagedCompany(tx, actor, input.companyId);
      const identity = await lockedIdentity(tx, input.email);
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
    });
    refreshMembers(input.companyId);
    return {
      success:
        "Acesso liberado. A pessoa já pode entrar com esse e-mail usando um código de acesso ou Google. Nenhuma mensagem foi enviada.",
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
