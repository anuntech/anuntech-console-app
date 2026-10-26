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
import { cookies, headers } from "next/headers";
import { reserveHourly } from "../http/hourly-limit";
import { createShareLinkAs, linkByToken, passwordMatches, revokeShareLinkAs, shareLinksFor, unlockCookieName, unlockValue } from "./share-links";
import { SHARE_LIMITS } from "./share-rules";

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

/** "Compartilhar por link…" and "Pedir arquivos…": returns the address once (only its hash is kept). */
export async function createShareLink(input: Record<string, string> | ActionState | null, form?: FormData) {
  const actor = await getActor();
  // Called from the dialog with an object, or posted as a form (the integration suite).
  const result = await createShareLinkAs(actor, form ? Object.fromEntries(form) : input);
  if (result.url) revalidatePath("/bookmarks");
  return result;
}

export async function listShareLinks(target: { bookmarkId?: string; folderId?: string }) {
  const actor = await getActor();
  return shareLinksFor(actor, target);
}

export async function revokeShareLink(linkId: string | ActionState | null, form?: FormData) {
  const actor = await getActor();
  return revokeShareLinkAs(actor, form ? String(form.get("id") ?? "") : String(linkId ?? ""));
}

/** A visitor types a link's password: right, and the link stays open in that browser for 12 hours. */
export async function unlockShareLink(_: ActionState, form: FormData): Promise<ActionState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const link = await linkByToken(token);
  if (!link?.passwordHash) return { error: "Link não encontrado." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await reserveHourly("share-password", `${link.id}:${ip}`, SHARE_LIMITS.password))) return { error: "Muitas tentativas nesta hora. Tente de novo mais tarde." };
  if (!(await passwordMatches(password, link.passwordHash))) return { error: "Senha incorreta." };
  (await cookies()).set(unlockCookieName(link), unlockValue(link), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 12 * 3600 });
  return { success: "Link aberto." };
}
