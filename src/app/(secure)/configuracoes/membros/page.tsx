import type { Metadata } from "next";
import { PreferencesPage } from "@/components/preferences/preferences-page";

export const metadata: Metadata = {
  title: "Membros",
  description: "Gerencie a equipe e as permissões de acesso às empresas no Console.",
};

export default function MembersPage() {
  return <PreferencesPage section="members" />;
}
