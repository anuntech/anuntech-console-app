import { cancelUpload } from "@/lib/drive/uploads";
import { uploadRoute } from "@/lib/drive/upload-route";

export const runtime = "nodejs";

/** Gives up on an upload: the parts already sent leave R2. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return uploadRoute(request, (actor) => cancelUpload(actor, id));
}
