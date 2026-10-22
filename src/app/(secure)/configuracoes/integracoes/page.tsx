import { SettingsShell } from "@/components/settings/settings-shell";
import { IntegrationsSection } from "@/components/settings/integrations-section";
export const metadata = { title: "Integrações" };
export default function Page() {
  return (
    <SettingsShell
      section="integrations"
      title="Integrações"
    >
      <IntegrationsSection />
    </SettingsShell>
  );
}
