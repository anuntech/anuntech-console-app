import "server-only";
import { notFound } from "next/navigation";
import { getActor, type Actor } from "./access";

/** Company administration is a tenant permission, separate from Console staff. */
export function managedCompanyIds(actor: Actor) {
  return [
    ...new Set(
      actor.grants
        .filter((grant) => grant.role === "manager")
        .map((grant) => grant.company.id),
    ),
  ];
}

export function canManageMembers(actor: Actor) {
  return actor.admin || managedCompanyIds(actor).length > 0;
}

export async function requireMemberManager() {
  const actor = await getActor();
  if (!canManageMembers(actor)) notFound();
  return actor;
}
