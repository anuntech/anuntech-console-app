import { publicRoute } from "@/lib/drive/public-route";
import { startVisitorUpload } from "@/lib/drive/share-links";

export const runtime = "nodejs";

/** A request link's visitor starts a file: `{ token, fileName, size, mime, senderName }` → `{ id, secret, partSize, partCount }`. */
export const POST = (request: Request) => publicRoute(request, (link, body, ip) => startVisitorUpload(link, body, ip));
