import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { MembersSection } from "@/components/settings/members-section";
export const metadata: Metadata = {
  title: "Membros",
  description:
    "Gerencie os membros e as permissões das empresas que você administra.",
};
export default function MembersPage() {
  return (
    <SettingsShell
      section="members"
      title="Membros"
      description="Pessoas do ambiente e o que cada uma pode fazer."
    >
      <MembersSection />
    </SettingsShell>
  );
}
