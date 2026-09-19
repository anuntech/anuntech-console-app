"use server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, eq, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getActor } from "./access";
import { companies, companyInvites, auditEvents } from "@/db/schema";
import { companyIdentity } from "./company-input";
import { companyBillingInput } from "./company-billing";
import { inviteHash, validInviteToken } from "./company-invites";
import type { ActionState } from "./action-state";
export type InviteLinkState = ActionState & { link?: string };
const failure = (e: unknown): ActionState => ({
  error:
    e instanceof z.ZodError
      ? e.issues[0].message
      : "Não foi possível salvar. Confira se a empresa já está cadastrada ou se este link foi cancelado ou utilizado.",
});
export async function createCompanyInvite(
  _: InviteLinkState,
  form: FormData,
): Promise<InviteLinkState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const label = z
      .string()
      .trim()
      .min(1, "Informe uma identificação para o link.")
      .max(160)
      .parse(form.get("label"));
    const token = randomBytes(32).toString("hex");
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(companyInvites)
        .values({
          label,
          tokenHash: inviteHash(token),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        })
        .returning();
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          action: "company_invite.created",
          entityId: row.id,
        });
    });
    revalidatePath("/empresas/convites");
    return {
      success:
        "Link criado. Copie e envie ao cliente. Válido por 7 dias e para um único envio.",
      link: `${process.env.BETTER_AUTH_URL || "http://localhost:3100"}/cadastro/empresa/${token}`,
    };
  } catch (e) {
    return failure(e);
  }
}
export async function submitCompanyInvite(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const token = String(form.get("token") || "");
  if (!validInviteToken(token))
    return { error: "Link inválido ou indisponível." };
  try {
    const identity = companyIdentity.parse(Object.fromEntries(form));
    const { billingAddress } = companyBillingInput(form);
    if (!billingAddress)
      return {
        error: "Preencha o endereço completo para cobrança e nota fiscal.",
      };
    const [row] = await db
      .update(companyInvites)
      .set({
        payload: { ...identity, billingAddress },
        status: "submitted",
        submittedAt: new Date(),
      })
      .where(
        and(
          eq(companyInvites.tokenHash, inviteHash(token)),
          eq(companyInvites.status, "open"),
          gt(companyInvites.expiresAt, new Date()),
        ),
      )
      .returning({ id: companyInvites.id });
    if (!row)
      return {
        error: "Este link expirou, foi cancelado ou já recebeu um cadastro.",
      };
    revalidatePath("/empresas/convites");
    revalidatePath(`/cadastro/empresa/${token}`);
    return {
      success:
        "Dados enviados à Anuntech para revisão. Não é necessário enviar novamente.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function approveCompanyInvite(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = z.string().uuid().parse(form.get("inviteId"));
    const identity = companyIdentity.parse(Object.fromEntries(form));
    const billing = companyBillingInput(form);
    if (!billing.billingAddress)
      return { error: "Complete o endereço antes de aprovar." };
    const company = await db.transaction(async (tx) => {
      const [invite] = await tx
        .update(companyInvites)
        .set({ status: "approved" })
        .where(
          and(
            eq(companyInvites.id, id),
            eq(companyInvites.status, "submitted"),
          ),
        )
        .returning();
      if (!invite) throw Error();
      const [row] = await tx
        .insert(companies)
        .values({ ...identity, ...billing })
        .returning();
      await tx
        .update(companyInvites)
        .set({ companyId: row.id, payload: null })
        .where(eq(companyInvites.id, id));
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId: row.id,
          action: "company.created",
          entityId: row.id,
          details: { inviteId: id },
        });
      return row;
    });
    revalidatePath("/empresas");
    revalidatePath("/empresas/convites");
    return { success: "Cadastro aprovado.", href: `/empresas/${company.id}` };
  } catch (e) {
    return failure(e);
  }
}
export async function revokeCompanyInvite(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = z.string().uuid().parse(form.get("inviteId"));
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(companyInvites)
        .set({ status: "revoked", payload: null })
        .where(
          and(
            eq(companyInvites.id, id),
            inArray(companyInvites.status, ["open", "submitted"]),
          ),
        )
        .returning();
      if (!row) throw Error();
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          action: "company_invite.revoked",
          entityId: id,
        });
    });
    revalidatePath("/empresas/convites");
    return { success: "Link cancelado.", href: "/empresas/convites" };
  } catch (e) {
    return failure(e);
  }
}
