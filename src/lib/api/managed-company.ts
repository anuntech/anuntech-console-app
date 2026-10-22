import "server-only";
import { ORPCError } from "@orpc/server";
import type { Actor } from "../access/access";
import { soleManagedCompanyId } from "../access/member-access";
import { missing } from "./access";

/**
 * The company behind the app's Dados da empresa, Membros and Notificações:
 * the one the person manages. Anyone else (a Membro, someone managing several
 * companies, the team) gets NOT_FOUND, like settingsEnvironment's 404 on the
 * web. The rules re-check the grant inside their transaction.
 */
export function managedCompany(actor: Actor) {
  const companyId = soleManagedCompanyId(actor);
  if (!companyId) throw missing();
  return companyId;
}

/** A refusal the person reads ({ error } of the shared rules). */
export const refuse = (message: string) => new ORPCError("BAD_REQUEST", { message });

/** The shared rules' answer: the success message, or BAD_REQUEST with the reason. */
export function answer(result: { error?: string; success?: string }) {
  if (result.error || !result.success) throw refuse(result.error || "Não foi possível concluir agora.");
  return { message: result.success };
}
