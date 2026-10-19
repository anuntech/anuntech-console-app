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
 * Whether the Gateway can authenticate: an API key (local work, tests), or
 * the project's OIDC token, which Vercel hands every function at runtime and
 * `vercel env pull` writes locally. Without either, AI features stay off.
 */
export function gatewayReady(env: Record<string, string | undefined> = process.env) {
  return !!env.AI_GATEWAY_API_KEY || !!env.VERCEL_OIDC_TOKEN || env.VERCEL === "1";
}
