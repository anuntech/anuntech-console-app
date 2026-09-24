import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { AccountSection } from "@/components/settings/account-section";
export const metadata: Metadata = {
  title: "Minha conta",
  description:
    "Consulte seus dados de acesso e gerencie o número de WhatsApp verificado.",
};
export default function AccountPage() {
  return (
    <SettingsShell
      section="account"
      title="Minha conta"
      description="Seu perfil e os contatos usados para entrar."
    >
      <AccountSection />
    </SettingsShell>
  );
}
