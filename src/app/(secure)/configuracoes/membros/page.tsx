import type { Metadata } from "next";
import { PreferencesPage } from "@/components/preferences/preferences-page";

export const metadata: Metadata = {
  title: "Membros",
  description:
    "Gerencie os membros e as permissões das empresas que você administra.",
};

export default function MembersPage() {
  return <PreferencesPage section="members" />;
}
