import type { Metadata } from "next";
import { PreferencesPage } from "@/components/preferences/preferences-page";

export const metadata: Metadata = {
  title: "Notificações",
  description: "Preferências e histórico de envios.",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  return <PreferencesPage section="notifications" notificationPage={page} />;
}
