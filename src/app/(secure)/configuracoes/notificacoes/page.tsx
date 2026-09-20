import type { Metadata } from "next";
import { PreferencesPage } from "@/components/preferences/preferences-page";

export const metadata: Metadata = {
  title: "Avisos de chamados",
  description:
    "Acompanhe destinatários, tentativas e confirmações de entrega dos avisos de chamados.",
};

export default function NotificationsPage() {
  return <PreferencesPage section="notifications" />;
}
