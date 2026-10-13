import { createPrivateKey, createPublicKey, randomUUID, sign, type KeyObject } from "node:crypto";
import type { PassRole } from "./registry";

/**
 * The Console pass: an RS256 JWT, valid for two minutes, that tells one app
 * who is opening it from the Console. The app verifies it against
 * /.well-known/jwks.json, keeps its own session cookie and drops the pass.
 *
 * Pure (node:crypto only, no env, no Next) so tests sign and verify with a key
 * of their own; pass.ts loads the real key on the server.
 */

/** Fixed: apps expect exactly this issuer, wherever the Console runs. */
export const PASS_ISSUER = "https://console.anuntech.com";
/** Seconds a pass lives: enough for the iframe to load it, too short to reuse. */
export const PASS_TTL = 120;

export type PassClaims = {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  name: string;
  company: string;
  role: PassRole;
  tenant?: string;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
};

export type PassKey = { privateKey: KeyObject; kid: string };

export type PublicJwk = { kty: "RSA"; n: string; e: string; kid: string; alg: "RS256"; use: "sig" };

const roles: readonly PassRole[] = ["staff", "manager", "member"];

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/**
 * The private key from APP_PASS_PRIVATE_KEY: a PKCS#8 PEM, base64-encoded so
 * it fits in one line (a raw PEM is accepted too). Only RSA of 2048 bits or
 * more, since RS256 is the one algorithm the apps accept.
 */
export function loadPassPrivateKey(value: string): KeyObject {
  const text = value.trim();
  const pem = text.startsWith("-----BEGIN") ? text : Buffer.from(text, "base64").toString("utf8");
  const key = createPrivateKey({ key: pem, format: "pem" });
  if (key.asymmetricKeyType !== "rsa") throw new Error("APP_PASS_PRIVATE_KEY precisa ser uma chave RSA (RS256).");
  if ((key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
    throw new Error("APP_PASS_PRIVATE_KEY precisa ter pelo menos 2048 bits.");
  return key;
}

/** The public half as the JWKS publishes it; nothing private leaves this function. */
export function publicJwk({ privateKey, kid }: PassKey): PublicJwk {
  const jwk = createPublicKey(privateKey).export({ format: "jwk" });
  if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) throw new Error("A chave do passe não é RSA.");
  return { kty: "RSA", n: jwk.n, e: jwk.e, kid, alg: "RS256", use: "sig" };
}

/** The claims of a pass for one person, one company and one app, starting now. */
export function passClaims(
  input: {
    app: string;
    user: { id: string; email: string; name: string };
    company: string;
    role: PassRole;
    tenant?: string;
  },
  now = Date.now(),
): PassClaims {
  const iat = Math.floor(now / 1000);
  return {
    iss: PASS_ISSUER,
    aud: input.app,
    sub: input.user.id,
    email: input.user.email,
    name: input.user.name,
    company: input.company,
    role: input.role,
    ...(input.tenant !== undefined ? { tenant: input.tenant } : {}),
    iat,
    nbf: iat,
    exp: iat + PASS_TTL,
    jti: randomUUID(),
  };
}

const filled = (value: unknown) => typeof value === "string" && value.trim().length > 0;

/**
 * What is wrong with a set of claims, or null when a pass can carry them. The
 * apps require `sub` and `company`; the rest keeps every pass the same shape.
 */
export function passClaimsProblem(claims: Partial<PassClaims>): string | null {
  for (const key of ["iss", "aud", "sub", "email", "company", "jti"] as const)
    if (!filled(claims[key])) return `falta ${key}`;
  if (typeof claims.name !== "string") return "falta name";
  if (claims.iss !== PASS_ISSUER) return "iss diferente do Console";
  if (!roles.includes(claims.role as PassRole)) return "role inválido";
  if ("tenant" in claims && !filled(claims.tenant)) return "tenant vazio";
  for (const key of ["iat", "nbf", "exp"] as const)
    if (!Number.isInteger(claims[key])) return `falta ${key}`;
  if (claims.exp! <= claims.iat! || claims.exp! - claims.iat! > PASS_TTL) return "validade fora de 2 minutos";
  return null;
}

/** Signs a pass with RS256; refuses claims an app would reject instead of sending them. */
export function signPass(claims: PassClaims, key: PassKey): string {
  const problem = passClaimsProblem(claims);
  if (problem) throw new Error(`Passe recusado: ${problem}.`);
  if (!filled(key.kid)) throw new Error("Passe recusado: falta o kid da chave.");
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: key.kid }));
  const payload = b64url(JSON.stringify(claims));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), key.privateKey);
  return `${header}.${payload}.${b64url(signature)}`;
}
