import "server-only";
import pattern from "@/components/ui/form-pattern.module.css";
import { getActor, requireAdmin } from "@/lib/access";
import { requireMemberManager } from "@/lib/member-access";
import { AppearanceContent } from "./appearance-content";
import { SecurityContent } from "./security-content";
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
  await (["account", "appearance", "security"].includes(section)
    ? getActor()
    : section === "members" ||
        section === "company" ||
        section === "notifications"
      ? requireMemberManager()
      : requireAdmin());
  return (
    <div data-preference-content={section} className={`${pattern.surface} ${section === "account" ? "" : pattern.rows}`}>
      {section === "appearance" ? (
        <AppearanceContent />
      ) : section === "security" ? (
        <SecurityContent />
      ) : section === "company" ? (
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
