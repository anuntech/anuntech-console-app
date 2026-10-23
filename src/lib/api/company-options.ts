import "server-only";
import type { Actor } from "../access/access";
import { companyDisplayName } from "../companies/display-name";

/**
 * The companies a client may narrow a list to (the web's `?company=` filter),
 * by display name and in name order: only those in `ids` (the area's
 * allowedIds), and only when there is more than one to choose from. The team
 * gets none: it reaches every company and arrives at one by link.
 */
export function companyOptions(actor: Actor, ids: Iterable<string>) {
  if (actor.admin) return [];
  const reach = new Set(ids);
  const options = [
    ...new Map(
      actor.grants
        .filter((g) => reach.has(g.company.id))
        .map((g) => [g.company.id, { id: g.company.id, name: companyDisplayName(g.company.name, g.company.document) }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return options.length > 1 ? options : [];
}
