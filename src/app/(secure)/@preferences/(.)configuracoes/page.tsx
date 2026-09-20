import { PreferencesPage } from "@/components/preferences/preferences-page";
export { metadata } from "../../configuracoes/page";

export default function IntegrationPreferences() {
  return <PreferencesPage section="integrations" intercepted />;
}
