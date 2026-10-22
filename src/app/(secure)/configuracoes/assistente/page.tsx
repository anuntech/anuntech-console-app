import { SettingsShell } from "@/components/settings/settings-shell";
import { AssistantSection } from "@/components/settings/assistant-section";
export const metadata = { title: "Assistente" };
export default function Page() {
  return (
    <SettingsShell
      section="assistant"
      title="Assistente"
    >
      <AssistantSection />
    </SettingsShell>
  );
}
