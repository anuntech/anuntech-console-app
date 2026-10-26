import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { fileUploads } from "@/db/schema";
import type { db } from "../db";
import type { Actor } from "../access/access";

/**
 * The finished upload a new bookmark names: the person's own, completed and
 * for the same space; marked used in the bookmark's transaction.
 */
export async function claimUpload(actor: Actor, uploadId: string, space: string | null, tx: Pick<typeof db, "update">) {
  if (!z.string().uuid().safeParse(uploadId).success) return null;
  const [row] = await tx
    .update(fileUploads)
    .set({ status: "used" })
    .where(
      and(
        eq(fileUploads.id, uploadId),
        eq(fileUploads.actorId, actor.user.id),
        eq(fileUploads.status, "completed"),
        space ? eq(fileUploads.companyId, space) : isNull(fileUploads.companyId),
      ),
    )
    .returning();
  return row ?? null;
}
