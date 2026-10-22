import { SettingsShell } from "@/components/settings/settings-shell";
import { SecuritySection } from "@/components/settings/security-section";
export const metadata = { title: "Segurança" };
export default function Page() {
  return (
    <SettingsShell
      section="security"
      title="Segurança"
    >
      <SecuritySection />
    </SettingsShell>
  );
}
