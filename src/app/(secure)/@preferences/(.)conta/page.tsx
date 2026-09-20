import { PreferencesPage } from "@/components/preferences/preferences-page";
export { metadata } from "../../conta/page";

export default function AccountPreferences() {
  return <PreferencesPage section="account" intercepted />;
}
