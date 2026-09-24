import { SettingsShell } from "@/components/settings/settings-shell";
import { CompanySection } from "@/components/settings/company-section";
export const metadata = { title: "Dados da empresa" };
export default function CompanyPreferences() {
  return (
    <SettingsShell
      section="company"
      title="Dados da empresa"
      description="O cadastro que aparece em cobranças, contratos e notas."
    >
      <CompanySection />
    </SettingsShell>
  );
}
