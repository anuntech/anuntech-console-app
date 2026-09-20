import type { Metadata } from "next";
import { PreferencesPage } from "@/components/preferences/preferences-page";

export const metadata: Metadata = {
  title: "Minha conta",
  description:
    "Consulte seus dados de acesso e gerencie o número de WhatsApp verificado.",
};

export default function AccountPage() {
  return <PreferencesPage section="account" />;
}
