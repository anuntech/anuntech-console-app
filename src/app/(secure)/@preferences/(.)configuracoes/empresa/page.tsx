import { PreferencesPage } from "@/components/preferences/preferences-page";
export const metadata = { title: "Dados da empresa" };
export default function CompanyPreferences() {
  return <PreferencesPage section="company" intercepted />;
}
