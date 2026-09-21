import "server-only";
import { getActor, requireAdmin } from "@/lib/access";
import { requireMemberManager } from "@/lib/member-access";
import { CompanyContent } from "./company-content";
import { AccountContent } from "./account-content";
import { IntegrationsContent } from "./integrations-content";
import { NotificationsContent } from "./notifications-content";
import { MembersContent } from "./members-content";
import { type PreferenceSection } from "./preferences-dialog";

/** Both the intercepted route and its direct URL enforce the same server access. */
export async function PreferencesPage({
  section,
  notificationPage,
}: {
  section: PreferenceSection;
  intercepted?: boolean;
  notificationPage?: string | string[];
}) {
  await (section === "account"
    ? getActor()
    : section === "members" || section === "company"
      ? requireMemberManager()
      : requireAdmin());
  return (
    <div data-preference-content={section}>
      {section === "company" ? (
        <CompanyContent />
      ) : section === "account" ? (
        <AccountContent />
      ) : section === "integrations" ? (
        <IntegrationsContent />
      ) : section === "members" ? (
        <MembersContent />
      ) : (
        <NotificationsContent page={notificationPage} />
      )}
    </div>
  );
}
