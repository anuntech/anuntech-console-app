/*
 * Reading Inter's charge webhook body, pure: it carries one object or a list
 * of them, each naming the charge by `codigoSolicitacao` (the id the Console
 * keeps as invoices.provider_id). Only well-formed ids pass, at most 50 per
 * call; the status in the body is never read (the check asks Inter itself).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const WEBHOOK_MAX_CHARGES = 50;

export function chargeIdsFromWebhook(body: unknown): string[] {
  const items = Array.isArray(body) ? body : body && typeof body === "object" ? [body] : [];
  const ids = new Set<string>();
  for (const item of items) {
    const id = item && typeof item === "object" ? (item as Record<string, unknown>).codigoSolicitacao : undefined;
    // As written and in lower case: the stored id keeps Inter's spelling.
    if (typeof id === "string" && UUID.test(id)) ids.add(id).add(id.toLowerCase());
    if (ids.size >= WEBHOOK_MAX_CHARGES * 2) break;
  }
  return [...ids];
}
