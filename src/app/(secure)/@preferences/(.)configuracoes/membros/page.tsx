import { PreferencesPage } from "@/components/preferences/preferences-page";
export { metadata } from "../../../configuracoes/membros/page";

export default function MemberPreferences() {
  return <PreferencesPage section="members" intercepted />;
}
