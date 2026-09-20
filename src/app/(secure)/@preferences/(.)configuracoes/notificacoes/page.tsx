import { PreferencesPage } from "@/components/preferences/preferences-page";
export { metadata } from "../../../configuracoes/notificacoes/page";

export default function NotificationPreferences() {
  return <PreferencesPage section="notifications" intercepted />;
}
