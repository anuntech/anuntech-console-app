import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { NotificationsSection } from "@/components/settings/notifications-section";
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
  return (
    <SettingsShell
      section="notifications"
      title="Notificações"
      description="Quem recebe os avisos, por qual canal, e o que já foi enviado."
    >
      <NotificationsSection page={page} />
    </SettingsShell>
  );
}
