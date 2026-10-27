import { publicRoute } from "@/lib/drive/public-route";
import { indexSoon } from "@/lib/drive/file-index";
import { finishVisitorUpload } from "@/lib/drive/share-links";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Every part sent: the file lands in the link's folder. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return publicRoute(request, async (link, body) => {
    const result = await finishVisitorUpload(link, id, body);
    if (result.ok) indexSoon();
    return result;
  });
}
