import "server-only";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { fileUploads } from "@/db/schema";
import { db } from "../../db";
import { storageConfigured } from "../../drive/r2";
import { cancelUpload, finishUpload, signParts, startUpload, type UploadResult } from "../../drive/uploads";
import { api } from "../server";
import { guard, missing } from "../access";
import { folderCompany } from "./bookmarks";

/*
 * Arquivos' uploads from the app: the same steps as the web's
 * /api/arquivos/envios routes (lib/drive/upload-route.ts), with the same core
 * (lib/drive/uploads.ts) and the same answers. The guard checks the company;
 * the core checks the folder, the quota and that the upload is the caller's.
 */

/** The company of an upload, for the guard; Anuntech's own space (null) stays on the web. */
const uploadCompany = async ({ id }: { id: string }) =>
  (await db.select({ companyId: fileUploads.companyId }).from(fileUploads).where(eq(fileUploads.id, id)))[0]?.companyId;

/** Without the R2 keys the app keeps sending small files to /api/v1/bookmarks/arquivo, as the web does. */
function needStorage() {
  if (!storageConfigured())
    throw new ORPCError("SERVICE_UNAVAILABLE", { status: 503, message: "O envio de arquivos grandes ainda não está disponível." });
}

const codes: Record<number, string> = { 400: "BAD_REQUEST", 413: "PAYLOAD_TOO_LARGE", 502: "BAD_GATEWAY", 503: "SERVICE_UNAVAILABLE" };

/** The core's answer: the value, or the web route's status and words. */
function settle<T>(result: UploadResult<T>): T {
  if (result.ok) return result.value;
  if (result.status === 404) throw missing();
  throw new ORPCError(codes[result.status] ?? "BAD_REQUEST", { status: result.status, message: result.error });
}

export const files = {
  startUpload: api.files.startUpload
    // Inside a folder, the folder's company; otherwise the one chosen, as bookmarks.create.
    .use(
      guard({
        area: "overview",
        company: async (input: { companyId: string; folderId: string }) =>
          input.folderId ? folderCompany({ id: input.folderId }) : input.companyId || null,
      }),
    )
    .handler(async ({ input, context }) => {
      needStorage();
      return settle(await startUpload(context.actor, input));
    }),
  signParts: api.files.signParts
    .use(guard({ area: "overview", company: uploadCompany }))
    .handler(async ({ input, context }) => {
      needStorage();
      return { parts: settle(await signParts(context.actor, input.id, input.parts)) };
    }),
  finishUpload: api.files.finishUpload
    .use(guard({ area: "overview", company: uploadCompany }))
    .handler(async ({ input, context }) => {
      needStorage();
      return settle(await finishUpload(context.actor, input.id, input.parts));
    }),
  cancelUpload: api.files.cancelUpload
    .use(guard({ area: "overview", company: uploadCompany }))
    .handler(async ({ input, context }) => {
      needStorage();
      settle(await cancelUpload(context.actor, input.id));
      return { cancelled: true };
    }),
};
