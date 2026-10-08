import { SettingsShell } from "@/components/settings/settings-shell";
import { AutomationsForm } from "@/components/settings/automations-form";
import { requireAdmin } from "@/lib/access/access";
import { automations } from "@/lib/automations/automations";
export const metadata = { title: "Automações" };
export default async function Page() {
  await requireAdmin();
  return (
    <SettingsShell
      section="automations"
      title="Automações"
      description="O que o Console faz sozinho. Cada passo sai uma vez e fica registrado; aqui você liga e desliga."
    >
      <AutomationsForm state={await automations()} />
    </SettingsShell>
  );
}
