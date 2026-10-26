import { signParts } from "@/lib/drive/uploads";
import { uploadRoute } from "@/lib/drive/upload-route";

export const runtime = "nodejs";

/** Addresses to PUT the next parts: `{ parts: [1, 2, …] }` (up to 100) → `[{ partNumber, url }]`, valid for an hour. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return uploadRoute(request, (actor, body) => signParts(actor, id, (body as { parts?: unknown } | null)?.parts));
}
