import { createHash } from "node:crypto";

/**
 * SHA-256 of a frozen document (a contract's or a quote's publication), as
 * printed on its PDF and checked before signing or answering. Keys are
 * sorted first: JSONB gives them back in its own order, so the hash must not
 * depend on insertion order.
 */
export const sha256Json = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
        )
      : value;

export const documentHash = (publication: object) => sha256Json(canonical(publication));
