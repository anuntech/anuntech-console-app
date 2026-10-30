"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, decisions } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { logDatabaseFault } from "../action-errors";
import { createProjectFromQuote } from "../quotes/quote-actions";
import { completeStep } from "./decision-rules";
import { settleDecision } from "./decisions";

const blocked = { error: "Você não tem permissão para fazer isso." };
const id = z.string().uuid();

/**
 * The steps that run from the queue itself, each through the action its own
 * screen uses: the same checks, the same audit, the same messages. Anything
 * not listed is a link and finishes on its screen.
 */
const RUNNERS: Record<string, (entityId: string) => Promise<ActionState>> = {
  "quote.start:project": (quoteId) => {
    const form = new FormData();
    form.set("id", quoteId);
    return createProjectFromQuote({}, form);
  },
};

function refresh() {
  revalidatePath("/piloto");
  revalidatePath("/painel");
}

/** "Fazer agora" on a step: runs it as the person who clicked, once. */
export async function runDecisionStep(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ id, step: z.string().min(1).max(40) }).parse(Object.fromEntries(form));
    const [decision] = await db.select().from(decisions).where(eq(decisions.id, input.id));
    if (!decision || decision.status !== "pending") return { error: "Esta decisão já foi resolvida." };
    const step = decision.steps.find((s) => s.key === input.step);
    const run = RUNNERS[`${decision.kind}:${input.step}`];
    if (!step || step.kind !== "action" || !run) return { error: "Este passo se faz na tela dele." };
    if (step.done) return { error: "Este passo já foi feito." };
    const result = await run(decision.entityId);
    if (result.error) return result;
    const now = new Date();
    const steps = completeStep(decision.steps, step.key, actor.user.id, now);
    const [updated] = await db
      .update(decisions)
      .set({ steps })
      .where(and(eq(decisions.id, decision.id), eq(decisions.status, "pending")))
      .returning();
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: decision.companyId,
      entityId: decision.id,
      action: "decision.step_done",
      details: { kind: decision.kind, step: step.key },
    });
    if (updated) await settleDecision(updated, now);
    refresh();
    return { success: result.success ?? "Feito." };
  } catch (e) {
    logDatabaseFault("runDecisionStep", e);
    return { error: e instanceof z.ZodError ? "Pedido inválido." : "Não foi possível fazer este passo agora." };
  }
}

/** "Dispensar": the decision does not apply, with the reason the history keeps. */
export async function dismissDecision(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const parsed = z
    .object({ id, reason: z.string().trim().min(3, "Diga por que não se aplica.").max(300, "O motivo pode ter até 300 caracteres.") })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const done = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(decisions)
        .set({ status: "dismissed", dismissReason: parsed.data.reason, decidedBy: actor.user.id, decidedAt: new Date() })
        .where(and(eq(decisions.id, parsed.data.id), eq(decisions.status, "pending")))
        .returning({ id: decisions.id, companyId: decisions.companyId, kind: decisions.kind });
      if (!row) return false;
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        entityId: row.id,
        action: "decision.dismissed",
        details: { kind: row.kind, reason: parsed.data.reason },
      });
      return true;
    });
    if (!done) return { error: "Esta decisão já foi resolvida." };
    refresh();
    return { success: "Decisão dispensada." };
  } catch (e) {
    logDatabaseFault("dismissDecision", e);
    return { error: "Não foi possível dispensar agora." };
  }
}
