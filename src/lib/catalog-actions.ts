"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  auditEvents,
  catalogItems,
  engagements,
  invoices,
  subscriptions,
} from "@/db/schema";
import { db } from "./db";
import { getActor } from "./access";
import type { ActionState } from "./action-state";
import { moneyToCents } from "./permissions";

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para fazer isso." };
const failure = (error: unknown): ActionState => ({
  error:
    error instanceof z.ZodError
      ? error.issues[0].message
      : "Não foi possível salvar. Confira os dados e tente novamente.",
});
function refresh() {
  revalidatePath("/configuracoes/catalogo");
  revalidatePath("/produtos");
  revalidatePath("/financeiro");
}
const text = (max: number, message?: string) =>
  z.string().trim().max(max, message ?? "O texto excede o tamanho permitido.").default("");
function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Creates or updates a catalog item (staff only). */
export async function saveCatalogItem(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        id: z.union([id, z.literal("")]).default(""),
        kind: z.enum(["product", "service"]),
        name: z.string().trim().min(1, "Dê um nome.").max(160),
        description: text(3000),
        url: text(2048),
        defaultAmount: text(20),
        interval: z.enum(["monthly", "yearly", ""]).default(""),
        whatWeDo: text(5000),
        whatWeNeed: text(5000),
        expectedResults: text(5000),
        deadlines: text(5000),
      })
      .parse(Object.fromEntries(form));
    if (input.url && !isWebUrl(input.url)) return { error: "Informe um link HTTP ou HTTPS válido." };
    const defaultAmountCents = input.defaultAmount ? moneyToCents(input.defaultAmount) : null;
    if (input.defaultAmount && defaultAmountCents === null)
      return { error: "Informe um valor entre R$ 0,01 e R$ 9.999.999,99." };
    const values = {
      kind: input.kind,
      name: input.name,
      description: input.description || null,
      url: input.kind === "product" && input.url ? input.url : null,
      defaultAmountCents,
      interval: input.interval || null,
      whatWeDo: input.kind === "service" ? input.whatWeDo || null : null,
      whatWeNeed: input.kind === "service" ? input.whatWeNeed || null : null,
      expectedResults: input.kind === "service" ? input.expectedResults || null : null,
      deadlines: input.kind === "service" ? input.deadlines || null : null,
      updatedAt: new Date(),
    };
    const itemId = input.id
      ? (
          await db
            .update(catalogItems)
            .set(values)
            .where(eq(catalogItems.id, input.id))
            .returning({ id: catalogItems.id })
        )[0]?.id
      : (await db.insert(catalogItems).values(values).returning({ id: catalogItems.id }))[0].id;
    if (!itemId) return blocked;
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      action: input.id ? "catalog.updated" : "catalog.created",
      entityId: itemId,
      details: { name: input.name, kind: input.kind },
    });
    refresh();
    return { success: input.id ? "Item atualizado." : "Item adicionado ao catálogo." };
  } catch (error) {
    return failure(error);
  }
}

/** Hides an item from new links (or brings it back); existing links keep working. */
export async function toggleCatalogItem(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const itemId = id.parse(form.get("id"));
    const [item] = await db
      .select({ active: catalogItems.active })
      .from(catalogItems)
      .where(eq(catalogItems.id, itemId));
    if (!item) return blocked;
    await db
      .update(catalogItems)
      .set({ active: !item.active, updatedAt: new Date() })
      .where(eq(catalogItems.id, itemId));
    refresh();
    return { success: item.active ? "Item desativado." : "Item reativado." };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Links a catalog item to a company with its price. Billing: a recurrence
 * in draft (nothing is issued or sent), an existing one, or none for now.
 */
export async function addCatalogEngagement(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        companyId: id,
        catalogItemId: id,
        amount: text(20),
        interval: z.enum(["monthly", "yearly"]).default("monthly"),
        billing: z.enum(["draft", "existing", "none"]).default("draft"),
        subscriptionId: z.union([id, z.literal("")]).default(""),
        dueDate: z.union([z.iso.date("Informe uma data válida."), z.literal("")]).default(""),
      })
      .parse(Object.fromEntries(form));
    const [item] = await db
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.id, input.catalogItemId), eq(catalogItems.active, true)));
    if (!item) return { error: "Escolha um item do catálogo." };
    const amountCents = input.amount ? moneyToCents(input.amount) : null;
    if (input.amount && amountCents === null)
      return { error: "Informe um valor entre R$ 0,01 e R$ 9.999.999,99." };
    if (input.billing === "draft" && (!amountCents || !input.dueDate))
      return { error: "Para criar a recorrência, informe o valor e o primeiro vencimento." };
    if (input.billing === "existing" && !input.subscriptionId)
      return { error: "Escolha a recorrência existente." };
    const created = await db.transaction(async (tx) => {
      let subscriptionId: string | null = null;
      if (input.billing === "existing") {
        const [sub] = await tx
          .select({ id: subscriptions.id, engagementId: subscriptions.engagementId })
          .from(subscriptions)
          .where(
            and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.companyId, input.companyId)),
          );
        if (!sub) throw new Error("Recorrência inválida para esta empresa.");
        if (sub.engagementId)
          throw new Error("Recorrência já vinculada a outro item. Cada recorrência paga um único produto ou serviço.");
        subscriptionId = sub.id;
      }
      const [row] = await tx
        .insert(engagements)
        .values({
          companyId: input.companyId,
          kind: item.kind,
          name: item.name,
          description: item.description,
          url: item.url,
          catalogItemId: item.id,
          amountCents,
          subscriptionId,
        })
        .returning({ id: engagements.id });
      if (input.billing === "draft") {
        const [sub] = await tx
          .insert(subscriptions)
          .values({
            companyId: input.companyId,
            engagementId: row.id,
            description: item.name,
            amountCents: amountCents!,
            interval: input.interval,
            anchorDay: Number(input.dueDate.slice(8)),
            anchorMonth: Number(input.dueDate.slice(5, 7)),
            nextDueDate: input.dueDate,
            actorId: actor.user.id,
          })
          .returning({ id: subscriptions.id });
        const [invoice] = await tx
          .insert(invoices)
          .values({
            companyId: input.companyId,
            subscriptionId: sub.id,
            engagementId: row.id,
            description: item.name,
            amountCents: amountCents!,
            dueDate: input.dueDate,
          })
          .returning({ id: invoices.id });
        await tx
          .update(engagements)
          .set({ subscriptionId: sub.id })
          .where(eq(engagements.id, row.id));
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: input.companyId,
          action: "invoice.drafted",
          entityId: invoice.id,
        });
      } else if (subscriptionId) {
        const linked = await tx
          .update(subscriptions)
          .set({ engagementId: row.id })
          .where(and(eq(subscriptions.id, subscriptionId), isNull(subscriptions.engagementId)))
          .returning({ id: subscriptions.id });
        if (!linked.length) throw new Error("Recorrência já vinculada a outro item. Cada recorrência paga um único produto ou serviço.");
      }
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: input.companyId,
        action: "engagement.created",
        entityId: row.id,
        details: { catalogItemId: item.id, billing: input.billing },
      });
      return row;
    });
    refresh();
    revalidatePath("/projetos");
    return {
      success:
        input.billing === "draft"
          ? `${item.kind === "service" ? "Serviço" : "Produto"} vinculado. A recorrência está em rascunho no Financeiro.`
          : `${item.kind === "service" ? "Serviço" : "Produto"} vinculado.`,
      href: item.kind === "service" ? `/produtos/${created.id}` : "/produtos",
    };
  } catch (error) {
    return error instanceof Error && error.message.includes("Recorrência")
      ? { error: error.message }
      : failure(error);
  }
}
