import { PreferencesPage } from "@/components/preferences/preferences-page";
export { metadata } from "../../../configuracoes/notificacoes/page";

export default async function NotificationPreferences({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  return (
    <PreferencesPage
      section="notifications"
      notificationPage={page}
      intercepted
    />
  );
}
