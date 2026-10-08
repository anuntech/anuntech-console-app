import { SettingsShell } from "@/components/settings/settings-shell";
import { AutomationsForm } from "@/components/settings/automations-form";
import { requireAdmin } from "@/lib/access/access";
import { automations } from "@/lib/automations/automations";
export const metadata = { title: "Automações" };
export default async function Page() {
  await requireAdmin();
  const state = await automations();
  return (
    <SettingsShell
      section="automations"
      title="Automações"
      description="Os avisos que saem sozinhos para os clientes e a triagem do Jev. Cada passo sai uma vez e fica registrado. Cobranças e avisos de chamados seguem as Notificações de cada empresa."
    >
      {/* Keyed by the saved state: after a save the switches start from what was stored, not from the first render. */}
      <AutomationsForm key={JSON.stringify(state)} state={state} />
    </SettingsShell>
  );
}
