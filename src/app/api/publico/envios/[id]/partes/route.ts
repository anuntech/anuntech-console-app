import { publicRoute } from "@/lib/drive/public-route";
import { signVisitorParts } from "@/lib/drive/share-links";

export const runtime = "nodejs";

/** The next parts' addresses, for the visitor who started the upload (`secret`). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return publicRoute(request, (link, body) => signVisitorParts(link, id, body));
}
