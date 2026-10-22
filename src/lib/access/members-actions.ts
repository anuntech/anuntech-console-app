"use server";
import {
  assertSingleEnvironment,
  lockEnvironmentAssignments,
} from "./environment-access";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditEvents, consoleStaffMembers } from "@/db/schema";
import { getActor } from "./access";
import type { ActionState } from "../action-state";
import { getConsoleStaffAccess } from "./console-members";
import { db } from "../db";
import { deliverInviteEmail } from "../auth/otp-delivery";
import { normalizeEmail } from "./permissions";
import { AccessChangeError } from "../companies/company-management";
import {
  lockedIdentity,
  memberEmailInput as emailInput,
  memberFailure as failure,
  memberIdInput as idInput,
  resendMemberInvite,
  revokeMember,
  saveMember,
  type MemberResult,
} from "./company-members";

const blocked = { error: "Você não tem permissão para fazer isso." };

function ownsConsole(emails: string[]) {
  const configured = process.env.CONSOLE_ADMIN_EMAIL?.trim();
  return !!configured && emails.includes(normalizeEmail(configured));
}

function refreshMembers(companyId?: string) {
  revalidatePath("/configuracoes/membros");
  revalidatePath("/", "layout");
  if (companyId) revalidatePath(`/empresas/${companyId}`);
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

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

/** Refreshes the pages a change touched and hands the form its message. */
function settle(result: MemberResult): ActionState {
  if ("error" in result) return result;
  refreshMembers(result.companyId);
  return { success: result.success };
}

export async function saveCompanyMember(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  return settle(
    await saveMember(actor, {
      companyId: text(form, "companyId"),
      email: text(form, "email"),
      role: text(form, "role"),
      // What a Membro sees changes only when the form sends the choice.
      scope: form.has("engagementAccess")
        ? { access: text(form, "engagementAccess"), ids: form.getAll("engagementIds").map(String) }
        : null,
    }),
  );
}

export async function revokeCompanyMember(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  return settle(await revokeMember(actor, { membershipId: text(form, "id") }));
}

/**
 * Sends the invite again to someone who never signed in: the team or the
 * company's Administrador, at most once a week per access.
 */
export async function resendInvite(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return settle(await resendMemberInvite(actor, { membershipId: text(form, "id") }));
}
