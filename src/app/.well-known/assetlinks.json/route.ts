import { androidAssetLinks } from "@/lib/api/app-links";

export const dynamic = "force-dynamic";

/** Android app links for the native app; 404 until ANDROID_CERT_SHA256 is set. */
export function GET() {
  const body = androidAssetLinks(process.env.ANDROID_CERT_SHA256);
  if (!body) return new Response(null, { status: 404 });
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
