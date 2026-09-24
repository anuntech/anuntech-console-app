import { SettingsShell } from "@/components/settings/settings-shell";
import { AppearanceSection } from "@/components/settings/appearance-section";
export const metadata = { title: "Aparência" };
export default function Page() {
  return (
    <SettingsShell
      section="appearance"
      title="Aparência"
      description="Como o Console se apresenta para você, neste navegador."
    >
      <AppearanceSection />
    </SettingsShell>
  );
}
