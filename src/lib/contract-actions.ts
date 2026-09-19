"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getActor } from "./access";
import { companies, contracts, auditEvents } from "@/db/schema";
import type { ActionState } from "./action-state";

const text = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(160),
  body: z
    .string()
    .transform((v) => v.replace(/\r\n?/g, "\n"))
    .pipe(
      z
        .string()
        .trim()
        .min(1, "Escreva o contrato.")
        .max(100000, "O contrato pode ter até 100 mil caracteres.")
        .regex(
          /^[^\x00-\x08\x0b\x0c\x0e-\x1f]*$/,
          "Remova os caracteres de controle do texto.",
        ),
    ),
});
const target = z.object({
  id: z.string().uuid(),
  revision: z.coerce.number().int().positive(),
});
const failure = (e: unknown): ActionState => ({
  error:
    e instanceof z.ZodError
      ? e.issues[0].message
      : e instanceof Error && e.message === "stale"
        ? "O contrato mudou em outra aba. Atualize a página antes de continuar."
        : "Não foi possível salvar o contrato. Confira os dados e tente novamente.",
});
function refresh(id: string) {
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${id}`);
}

export async function createContract(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const input = text
      .extend({ companyId: z.string().uuid() })
      .parse(Object.fromEntries(form));
    const row = await db.transaction(async (tx) => {
      const [company] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, input.companyId));
      if (!company) throw Error();
      const [c] = await tx
        .insert(contracts)
        .values({ ...input, authorId: actor.user.id })
        .returning();
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId: c.companyId,
          entityId: c.id,
          action: "contract.created",
        });
      return c;
    });
    refresh(row.id);
    return {
      success:
        "Rascunho salvo. Revise e publique para disponibilizar ao cliente.",
      href: `/contratos/${row.id}`,
    };
  } catch (e) {
    return failure(e);
  }
}

export async function saveContract(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const input = target.merge(text).parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, input.id))
        .for("update");
      if (!c || c.revision !== input.revision) throw Error("stale");
      await tx
        .update(contracts)
        .set({
          title: input.title,
          body: input.body,
          revision: c.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, c.id));
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId: c.companyId,
          entityId: c.id,
          action: "contract.draft_updated",
        });
    });
    refresh(input.id);
    return {
      success:
        "Rascunho salvo. Publique para atualizar o conteúdo disponível ao cliente.",
    };
  } catch (e) {
    return failure(e);
  }
}

async function changePublication(
  form: FormData,
  publish: boolean,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const input = target.parse(Object.fromEntries(form));
    if (form.get("confirm") !== "yes")
      return { error: "Confirme a alteração de disponibilidade do contrato." };
    await db.transaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, input.id))
        .for("update");
      if (!c || c.revision !== input.revision) throw Error("stale");
      const [company] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, c.companyId));
      if (publish) {
        await tx
          .update(contracts)
          .set({
            publication: {
              title: c.title,
              body: c.body,
              companyName: company.name,
              companyDocument: company.document,
            },
            publishedAt: new Date(),
            publishedVersion: c.publishedVersion + 1,
            revision: c.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, c.id));
      } else {
        await tx
          .update(contracts)
          .set({
            publishedAt: null,
            revision: c.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, c.id));
      }
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId: c.companyId,
          entityId: c.id,
          action: publish ? "contract.published" : "contract.unpublished",
          details: { version: c.publishedVersion + (publish ? 1 : 0) },
        });
    });
    refresh(input.id);
    return {
      success: publish
        ? "Contrato publicado. O cliente já pode visualizar e baixar o PDF."
        : "Contrato retirado da área do cliente. O rascunho foi preservado.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function publishContract(_: ActionState, form: FormData) {
  return changePublication(form, true);
}
export async function unpublishContract(_: ActionState, form: FormData) {
  return changePublication(form, false);
}
