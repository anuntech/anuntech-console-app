import "server-only";
import { loadPassPrivateKey, publicJwk, signPass, type PassClaims, type PassKey, type PublicJwk } from "./pass-token";

/** The pass key is not configured (or is unreadable): no pass goes out unsigned. */
export class PassKeyError extends Error {}

let cached: { source: string; key: PassKey } | undefined;

/**
 * The signing key from APP_PASS_PRIVATE_KEY and APP_PASS_KEY_ID. Read once per
 * value; a missing or broken key fails closed with a message for the logs.
 */
function passKey(): PassKey {
  const raw = process.env.APP_PASS_PRIVATE_KEY?.trim();
  const kid = process.env.APP_PASS_KEY_ID?.trim();
  const missing = [!raw && "APP_PASS_PRIVATE_KEY", !kid && "APP_PASS_KEY_ID"].filter(Boolean);
  if (missing.length)
    throw new PassKeyError(`Passe do Console desligado: defina ${missing.join(" e ")} para abrir apps protegidos.`);
  const source = `${kid}:${raw}`;
  if (cached?.source === source) return cached.key;
  try {
    const key = { privateKey: loadPassPrivateKey(raw!), kid: kid! };
    cached = { source, key };
    return key;
  } catch (error) {
    throw new PassKeyError(
      `Passe do Console desligado: APP_PASS_PRIVATE_KEY não é uma chave RSA PKCS#8 válida (${error instanceof Error ? error.message : "erro desconhecido"}).`,
    );
  }
}

/** A signed pass, or PassKeyError when the Console has no key to sign with. */
export function issuePass(claims: PassClaims) {
  return signPass(claims, passKey());
}

/** The public keys the apps verify passes with. */
export function passJwks(): { keys: PublicJwk[] } {
  return { keys: [publicJwk(passKey())] };
}
