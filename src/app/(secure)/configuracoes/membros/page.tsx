import type { Metadata } from "next";
import { getActor } from "@/lib/access/access";
import { SettingsShell } from "@/components/settings/settings-shell";
import { MembersSection } from "@/components/settings/members-section";
import { MarkFirstStep } from "@/components/guide/first-steps-card";
export const metadata: Metadata = {
  title: "Membros",
  description:
    "Quem acessa o Console e o que cada pessoa pode fazer.",
};
export default async function MembersPage() {
  // Whose people these are is already said by the rail ("Anuntech" or "Empresa") and the invite hint.
  const actor = await getActor();
  return (
    <SettingsShell section="members" title="Membros">
      <MembersSection />
      {!actor.admin && actor.grants.length > 0 && <MarkFirstStep companyId={actor.grants[0].company.id} step="members_reviewed" />}
    </SettingsShell>
  );
}
