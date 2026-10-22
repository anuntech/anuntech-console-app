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

/**
 * The one company a client's Administrador runs from Configurações (Dados da
 * empresa, Membros, Notificações), or null: a Membro, someone managing several
 * companies, or the team (whose settings are the Anuntech environment).
 */
export function soleManagedCompanyId(actor: Actor) {
  if (actor.admin) return null;
  const ids = managedCompanyIds(actor);
  return ids.length === 1 ? ids[0] : null;
}

export function canManageMembers(actor: Actor) {
  return actor.admin || managedCompanyIds(actor).length > 0;
}

export async function requireMemberManager() {
  const actor = await getActor();
  if (!canManageMembers(actor)) notFound();
  return actor;
}
