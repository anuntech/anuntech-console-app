import "server-only";
import { and, eq } from "drizzle-orm";
import { memberships } from "@/db/schema";
import { db } from "../../db";
import { roleLabels } from "../../format";
import { avatarView } from "../../account/avatar-view";
import { companyPeople } from "../../access/company-people";
import { resendMemberInvite, revokeMember, saveMember } from "../../access/company-members";
import { scopeChoices } from "../../access/member-scope";
import { scopeSummary } from "../../access/scope-summary";
import { markCompanyStep } from "../../guide/mark-step";
import { logDatabaseFault } from "../../action-errors";
import { api } from "../server";
import { guard, missing } from "../access";
import { answer, managedCompany } from "../managed-company";

/** A membership of another company (or none) answers NOT_FOUND, like a record that does not exist. */
async function ownMembership(companyId: string, membershipId: string) {
  const [row] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.companyId, companyId)));
  if (!row) throw missing();
}

const kindLabels: Record<string, string> = { product: "Produto", service: "Serviço", project: "Projeto" };

/**
 * Configurações → Membros for the company the person manages. memberId is the
 * membership's id; the rules accept only one of the managed company.
 */
export const members = {
  list: api.members.list.use(guard({ self: true })).handler(async ({ context }) => {
    const { actor } = context;
    const companyId = managedCompany(actor);
    const [people, choices] = await Promise.all([companyPeople(actor, companyId), scopeChoices(companyId)]);
    // Reviewing who has access is a first step, dated by the latest review (as on the web).
    await markCompanyStep(actor, companyId, "members_reviewed").catch((error) => logDatabaseFault("first steps", error));
    return {
      people: people.map((person) => {
        const scope = person.scope ?? { access: "all" as const, ids: [] };
        const role = person.role === "manager" ? ("manager" as const) : ("member" as const);
        return {
          key: person.key,
          memberId: person.memberId,
          name: person.name,
          email: person.email,
          // One's own photo comes by /api/conta/foto; someone else's by their account.
          avatar: avatarView(person.image, person.self ? undefined : (person.userId ?? "")),
          self: person.self,
          pending: person.pending,
          role,
          roleLabel: roleLabels[role],
          statusLabel: person.pending ? "Aguardando primeiro acesso" : "Ativo",
          scope,
          scopeLabel: scopeSummary(scope),
        };
      }),
      choices: choices.map((choice) => ({ id: choice.id, name: choice.name, kindLabel: kindLabels[choice.kind] ?? choice.kind })),
    };
  }),
  save: api.members.save.use(guard({ self: true })).handler(async ({ input, context }) => {
    const companyId = managedCompany(context.actor);
    return answer(await saveMember(context.actor, { companyId, email: input.email, role: input.role, scope: input.scope ?? null }));
  }),
  revoke: api.members.revoke.use(guard({ self: true })).handler(async ({ input, context }) => {
    await ownMembership(managedCompany(context.actor), input.memberId);
    return answer(await revokeMember(context.actor, { membershipId: input.memberId }));
  }),
  resendInvite: api.members.resendInvite.use(guard({ self: true })).handler(async ({ input, context }) => {
    await ownMembership(managedCompany(context.actor), input.memberId);
    return answer(await resendMemberInvite(context.actor, { membershipId: input.memberId }));
  }),
};
