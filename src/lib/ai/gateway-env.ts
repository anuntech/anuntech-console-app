/*
 * Every AI call of the Console goes through the Vercel AI Gateway. These are
 * the parts with no SDK in them, so the browser bundle and the tests can
 * import them: whether the Gateway can be reached from here, and what every
 * call that carries client data asks of the providers.
 */

/**
 * Client data only goes to providers that keep nothing and train on nothing.
 * Zero retention already implies no training; both are sent so the intent
 * stays explicit. A model with no such provider fails instead of falling back.
 */
export const PRIVATE_GATEWAY = { zeroDataRetention: true, disallowPromptTraining: true } as const;

/**
 * How the Gateway authenticates here: an API key (local work, tests), or the
 * project's OIDC token, which Vercel hands every production function at
 * runtime and `vercel env pull` writes locally. Preview deployments only get
 * AI with a token or a key of their own, so they never spend the team's
 * credits by default. Null keeps every AI feature off.
 */
export function gatewayCredential(env: Record<string, string | undefined> = process.env): "key" | "oidc" | null {
  if (env.AI_GATEWAY_API_KEY) return "key";
  if (env.VERCEL_OIDC_TOKEN || env.VERCEL_ENV === "production") return "oidc";
  return null;
}

export const gatewayReady = (env: Record<string, string | undefined> = process.env) => gatewayCredential(env) !== null;
