import { publicRoute } from "@/lib/drive/public-route";
import { finishVisitorUpload } from "@/lib/drive/share-links";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Every part sent: the file lands in the link's folder. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return publicRoute(request, (link, body) => finishVisitorUpload(link, id, body));
}
