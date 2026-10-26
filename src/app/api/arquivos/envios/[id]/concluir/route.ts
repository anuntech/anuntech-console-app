import { finishUpload } from "@/lib/drive/uploads";
import { uploadRoute } from "@/lib/drive/upload-route";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Every part sent: `{ parts: [{ partNumber, etag }] }`. R2 joins them and the size is checked. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return uploadRoute(request, (actor, body) => finishUpload(actor, id, (body as { parts?: unknown } | null)?.parts));
}
