import { SettingsShell } from "@/components/settings/settings-shell";
import { AppearanceSection } from "@/components/settings/appearance-section";
export const metadata = { title: "Aparência" };
export default function Page() {
  return (
    <SettingsShell
      section="appearance"
      title="Aparência"
      description="Vale só para este navegador."
    >
      <AppearanceSection />
    </SettingsShell>
  );
}
