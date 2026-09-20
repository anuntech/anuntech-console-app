import type { Metadata } from "next";
import { PreferencesPage } from "@/components/preferences/preferences-page";

export const metadata: Metadata = {
  title: "Integrações",
  description:
    "Consulte as integrações e preferências administrativas do Console.",
};

export default function SettingsPage() {
  return <PreferencesPage section="integrations" />;
}
