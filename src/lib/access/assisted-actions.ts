"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { companies, auditEvents } from "@/db/schema";
import { requireAdmin } from "./access";
import { auth } from "../auth/auth";
import { ASSIST_COOKIE } from "./assisted-session";
import type { ActionState } from "../action-state";
const ASSIST_MAX_AGE = 60 * 60 * 6;
export async function startAssistedSession(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const companyId = String(form.get("companyId") || "");
  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId));
  if (!company) return { error: "Empresa não encontrada." };
  (await cookies()).set(ASSIST_COOKIE, company.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ASSIST_MAX_AGE,
  });
  await db.insert(auditEvents).values({
    actorId: actor.user.id,
    companyId: company.id,
    action: "assisted.started",
    entityId: company.id,
    details: { company: company.name },
  });
  // A server redirect: the page that submitted may no longer exist for the assisted view.
  redirect("/painel");
}
export async function endAssistedSession(
  _previous: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _previous;
  void _form;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Sua sessão expirou. Entre de novo." };
  const companyId = (await cookies()).get(ASSIST_COOKIE)?.value;
  (await cookies()).delete(ASSIST_COOKIE);
  if (companyId)
    await db.insert(auditEvents).values({
      actorId: session.user.id,
      companyId,
      action: "assisted.ended",
      entityId: companyId,
      details: null,
    });
  redirect("/empresas");
}
