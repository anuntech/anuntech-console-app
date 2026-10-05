"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, environmentProfile } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import type { LocalHolidays } from "./business-calendar";

/**
 * The seat's holidays beyond the national ones: the contracts count business
 * days without them (SUP 2.2). One per line, "25/01 Aniversário da cidade".
 */
export async function saveHolidays(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Você não tem permissão para fazer isso." };
  const input = z
    .object({
      city: z.string().trim().max(80).default(""),
      dates: z.string().max(4000).default(""),
      corpusChristi: z.string().optional(),
      carnival: z.string().optional(),
    })
    .parse(Object.fromEntries(form));
  const dates: NonNullable<LocalHolidays["dates"]> = [];
  for (const raw of input.dates.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)$/);
    const day = match ? Number(match[1]) : 0;
    const month = match ? Number(match[2]) : 0;
    if (!match || month < 1 || month > 12 || day < 1 || day > 31)
      return { error: `Não entendi "${raw}". Use uma linha por feriado, como 25/01 Aniversário da cidade.` };
    dates.push({ date: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, name: match[3].slice(0, 60) });
  }
  const holidays: LocalHolidays = {
    city: input.city || undefined,
    dates,
    corpusChristi: input.corpusChristi === "on",
    carnival: input.carnival === "on",
  };
  const [row] = await db
    .update(environmentProfile)
    .set({ holidays, updatedAt: new Date() })
    .where(eq(environmentProfile.id, "console"))
    .returning({ id: environmentProfile.id });
  if (!row) return { error: "Salve primeiro os dados da Anuntech acima." };
  await db.insert(auditEvents).values({ actorId: actor.user.id, action: "settings.holidays_updated", entityId: "console", details: holidays });
  revalidatePath("/configuracoes/empresa");
  return { success: "Feriados salvos. Os prazos novos já contam com eles." };
}
