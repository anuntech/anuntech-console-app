import { passJwks, PassKeyError } from "@/lib/apps/pass";

// Read at request time: the key comes from the environment, never from the build.
export const dynamic = "force-dynamic";

/**
 * The public key apps use to verify the Console pass (lib/apps/pass-token.ts).
 * Public on purpose: no session, no secret, cached for five minutes. Without a
 * configured key it answers 503, so no app ever trusts an empty key set.
 */
export async function GET() {
  try {
    return Response.json(passJwks(), {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    if (!(error instanceof PassKeyError)) throw error;
    console.error(error.message);
    return Response.json(
      { error: "Chave do passe do Console não configurada." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
