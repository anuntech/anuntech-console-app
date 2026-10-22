import type { ContractPublication } from "@/db/schema";
import { documentHash, sha256Json } from "../document-hash";

/** SHA-256 of the contract's frozen text (canonical key order). */
export const contractHash = (publication: ContractPublication) => documentHash(publication);

/** Contracts sent before the canonical hash were hashed in insertion order. */
const LEGACY_ORDERS: (keyof ContractPublication)[][] = [
  ["title", "body", "companyName", "companyDocument", "kind", "parentTitle", "parentHash", "startsAt", "endsAt"],
  ["title", "body", "companyName", "companyDocument"],
];

/** Whether the stored hash still describes the frozen text, accepting the legacy key orders. */
export function contractHashMatches(publication: ContractPublication, hash: string) {
  if (contractHash(publication) === hash) return true;
  return LEGACY_ORDERS.some((order) => {
    const ordered: Record<string, unknown> = {};
    for (const key of order) if (key in publication) ordered[key] = publication[key];
    return Object.keys(ordered).length === Object.keys(publication).length && sha256Json(ordered) === hash;
  });
}
