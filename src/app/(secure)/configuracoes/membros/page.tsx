import type { Metadata } from "next";
import { getActor } from "@/lib/access";
import { SettingsShell } from "@/components/settings/settings-shell";
import { MembersSection } from "@/components/settings/members-section";
export const metadata: Metadata = {
  title: "Membros",
  description:
    "Quem acessa o Console e o que cada pessoa pode fazer.",
};
export default async function MembersPage() {
  // The list card has no heading of its own, so the page says whose people these are.
  const actor = await getActor();
  return (
    <SettingsShell
      section="members"
      title="Membros"
      description={
        actor.admin
          ? "Quem administra o Console da Anuntech."
          : "Quem entra no Console em nome da sua empresa e o que cada pessoa pode fazer."
      }
    >
      <MembersSection />
    </SettingsShell>
  );
}
