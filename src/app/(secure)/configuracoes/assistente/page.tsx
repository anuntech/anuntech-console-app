import { SettingsShell } from "@/components/settings/settings-shell";
import { AssistantSection } from "@/components/settings/assistant-section";
export const metadata = { title: "Assistente" };
export default function Page() {
  return (
    <SettingsShell
      section="assistant"
      title="Assistente"
      description="O modelo, as instruções da Anuntech e a base de conhecimento que o assistente do Console usa."
    >
      <AssistantSection />
    </SettingsShell>
  );
}
