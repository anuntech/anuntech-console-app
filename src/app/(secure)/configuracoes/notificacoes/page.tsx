import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { MarkFirstStep } from "@/components/guide/first-steps-card";
import { getActor } from "@/lib/access/access";
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
  const actor = await getActor();
  return (
    <SettingsShell
      section="notifications"
      title="Notificações"
    >
      <NotificationsSection page={page} />
      {!actor.admin && actor.grants.length > 0 && <MarkFirstStep companyId={actor.grants[0].company.id} step="notices_reviewed" />}
    </SettingsShell>
  );
}
