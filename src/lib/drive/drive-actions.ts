"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, companies } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { DEFAULT_COMPANY_QUOTA_BYTES, bytesLabel } from "./drive-rules";

const GB = 1024 ** 3;

/** The team sets a company's space in Arquivos, in whole gigabytes; empty goes back to the default (5 GB). */
export async function setStorageQuota(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Você não tem permissão para fazer isso." };
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      quotaGb: z.union([z.literal(""), z.coerce.number().int("Use um número inteiro de GB.").min(1, "Use pelo menos 1 GB.").max(10_000, "Use até 10.000 GB.")]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const quota = parsed.data.quotaGb === "" ? null : parsed.data.quotaGb * GB;
  try {
    const [row] = await db.update(companies).set({ storageQuotaBytes: quota }).where(eq(companies.id, parsed.data.companyId)).returning({ id: companies.id });
    if (!row) return { error: "Empresa não encontrada." };
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: row.id,
      action: "company.storage_quota",
      entityId: row.id,
      details: { quotaBytes: quota },
    });
  } catch (error) {
    logDatabaseFault("setStorageQuota", error);
    return { error: DATABASE_FAILURE };
  }
  revalidatePath(`/empresas/${parsed.data.companyId}`);
  revalidatePath("/bookmarks");
  return { success: `Espaço em Arquivos: ${bytesLabel(quota ?? DEFAULT_COMPANY_QUOTA_BYTES)}${quota === null ? " (o padrão)" : ""}.` };
}
