import "server-only";
import { settingsEnvironment } from "@/lib/access/environment";
import { companyPeople, staffPeople } from "@/lib/access/company-people";
import { scopeChoices } from "@/lib/access/member-scope";
import { MembersTable } from "./members-table";

export async function MembersSection() {
  const { actor, companyId } = await settingsEnvironment();
  const staff = actor.admin;
  const people = staff
    ? await staffPeople(actor)
    : await companyPeople(actor, companyId!);
  const canInvite = staff ? actor.owner : true;
  return (
    <MembersTable
      people={people}
      companyId={companyId ?? undefined}
      staff={staff}
      canAct={canInvite}
      engagements={staff || !companyId ? undefined : await scopeChoices(companyId)}
    />
  );
}
