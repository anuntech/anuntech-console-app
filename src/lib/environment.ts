import "server-only";
import { notFound } from "next/navigation";
import { managedCompanyIds, requireMemberManager } from "./member-access";

/** Settings always belong to one environment; Console staff use the internal one. */
export async function settingsEnvironment() {
  const actor = await requireMemberManager();
  if (actor.admin) return { actor, companyId: null };
  const ids = managedCompanyIds(actor);
  if (ids.length !== 1) notFound();
  return { actor, companyId: ids[0] };
}
