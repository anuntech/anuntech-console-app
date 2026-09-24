import { SettingsShell } from "@/components/settings/settings-shell";
import { ContractTemplatesSection } from "@/components/settings/contract-templates-section";
export const metadata = { title: "Modelos de contrato" };
export default function Page() {
  return (
    <SettingsShell
      section="contracts"
      title="Modelos de contrato"
      description="O texto de cada contrato, escrito uma vez. Cada cliente recebe uma cópia com os dados dele."
    >
      <ContractTemplatesSection />
    </SettingsShell>
  );
}
