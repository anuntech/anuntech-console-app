"use server";
import { brandEmailHtml } from "@/lib/email/brand-email";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { getActor } from "./access";
import {
  companies,
  memberships,
  emailDeliveries,
  auditEvents,
} from "@/db/schema";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "../action-state";
export async function sendAccessNotice(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  const input = z.string().uuid().safeParse(form.get("id"));
  if (!input.success) return { error: "Este acesso não existe mais. Atualize a página." };
  const base = process.env.BETTER_AUTH_URL;
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    !base?.startsWith("https://")
  )
    return {
      error:
        "Configure o remetente e o endereço público HTTPS antes de enviar avisos.",
    };
  try {
    const [entry] = await db
      .select({ membership: memberships, company: companies.name })
      .from(memberships)
      .innerJoin(companies, eq(companies.id, memberships.companyId))
      .where(and(eq(memberships.id, input.data), eq(memberships.active, true)));
    if (!entry) return { error: "Este acesso não está ativo." };
    const key = `access-notice-${entry.membership.id}`;
    const subject = "Seu acesso ao Console da Anuntech";
    const text = `Seu acesso à empresa ${entry.company} no Console da Anuntech foi liberado.\n\nPara entrar, abra ${base}/entrar e use este e-mail. Um código chega na sua caixa de entrada, ou você entra com o Google.\n\nSe você não reconhece este acesso, fale com a Anuntech.\n\nAnuntech`;
    const payload = {
      from: process.env.EMAIL_FROM,
      to: [entry.membership.email],
      subject,
      text,
      html: brandEmailHtml({ subject, title: "Seu acesso foi liberado", text, url: base, action: { label: "Entrar no Console", url: `${base}/entrar` } }),
    };
    await db
      .insert(emailDeliveries)
      .values({ id: key, membershipId: entry.membership.id, payload })
      .onConflictDoNothing();
    const [delivery] = await db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.id, key));
    if (delivery.status === "accepted")
      return {
        success:
          "O aviso já foi aceito pelo Resend. Nenhuma nova mensagem foi enviada.",
      };
    if (Date.now() - delivery.createdAt.getTime() > 23 * 60 * 60 * 1000)
      return {
        error:
          "O prazo seguro para repetir esta tentativa expirou. Consulte o envio no Resend antes de reenviar.",
      };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(delivery.payload),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || !result.id) {
      await db
        .update(emailDeliveries)
        .set({ status: "failed" })
        .where(eq(emailDeliveries.id, key));
      return {
        error:
          "O Resend não confirmou o envio. Confira o remetente e a configuração antes de tentar novamente.",
      };
    }
    await db.transaction(async (tx) => {
      const changed = await tx
        .update(emailDeliveries)
        .set({ status: "accepted", providerId: result.id })
        .where(
          and(
            eq(emailDeliveries.id, key),
            eq(emailDeliveries.status, delivery.status),
          ),
        )
        .returning();
      if (changed.length)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: entry.membership.companyId,
          action: "access_notice.accepted",
          entityId: entry.membership.id,
          details: { providerId: result.id },
        });
    });
    revalidatePath(`/empresas/${entry.membership.companyId}`);
    return {
      success:
        "Aviso aceito pelo Resend. A entrega deve ser acompanhada no painel do provedor.",
    };
  } catch {
    return {
      error:
        "Não foi possível confirmar o envio. Tente novamente dentro de 23 horas para reutilizar a mesma tentativa, sem duplicar a mensagem.",
    };
  }
}
