import { appleAssociation } from "@/lib/api/app-links";

export const dynamic = "force-dynamic";

/** iOS universal links for the native app; 404 until APPLE_TEAM_ID is set. */
export function GET() {
  const body = appleAssociation(process.env.APPLE_TEAM_ID);
  if (!body) return new Response(null, { status: 404 });
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
