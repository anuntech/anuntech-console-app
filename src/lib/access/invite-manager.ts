import "server-only";
import { and, eq } from "drizzle-orm";
import { companies, memberships } from "@/db/schema";
import { db } from "../db";
import type { ActionState } from "../action-state";
import { saveCompanyMember } from "./members-actions";

/*
 * A contract or a proposal sent to a company with no Administrador reaches
 * nobody: only an Administrador signs or answers. The send dialog asks the
 * team for that person first. The Console never invites on its own; the
 * e-mail is only a suggestion the team confirms.
 */

/** Null when the company already has an active Administrador; otherwise who to suggest (its billing e-mail). */
export async function managerInvite(companyId: string): Promise<{ suggestion: string } | null> {
  const [manager] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.companyId, companyId), eq(memberships.role, "manager"), eq(memberships.active, true)))
    .limit(1);
  if (manager) return null;
  const [company] = await db.select({ email: companies.billingEmail }).from(companies).where(eq(companies.id, companyId));
  return { suggestion: company?.email ?? "" };
}

/**
 * After the document went out: gives the typed e-mail access as
 * Administrador, so the send's notice reaches them. Returns a line for the
 * success message when the access could not be given; the send stands.
 */
export async function inviteManagerOnSend(form: FormData, companyId: string): Promise<string | null> {
  const email = String(form.get("inviteEmail") ?? "").trim();
  if (!email || !(await managerInvite(companyId))) return null;
  const access = new FormData();
  access.set("companyId", companyId);
  access.set("email", email);
  access.set("role", "manager");
  const result: ActionState = await saveCompanyMember({}, access);
  return result.error ? `Não foi possível liberar o acesso de ${email}: ${result.error}` : null;
}
