import { PreferencesPage } from "@/components/preferences/preferences-page";
export { metadata } from "../../../configuracoes/seguranca/page";
export default function Page() { return <PreferencesPage section="security" intercepted />; }
