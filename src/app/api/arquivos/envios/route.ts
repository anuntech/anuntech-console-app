import { startUpload } from "@/lib/drive/uploads";
import { uploadRoute } from "@/lib/drive/upload-route";

export const runtime = "nodejs";

/** Starts a file's way to R2: `{ companyId, folderId, fileName, size, mime }` → `{ id, partSize, partCount }`. */
export const POST = (request: Request) => uploadRoute(request, (actor, body) => startUpload(actor, body));
