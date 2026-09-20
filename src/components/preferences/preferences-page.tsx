import "server-only";
import { getActor, requireAdmin } from "@/lib/access";
import { AccountContent } from "./account-content";
import { IntegrationsContent } from "./integrations-content";
import { NotificationsContent } from "./notifications-content";
import {
  PreferencesDialog,
  type PreferenceSection,
} from "./preferences-dialog";

const copy = {
  account: {
    title: "Minha conta",
    description: "Seus dados de acesso e as formas de entrar no Console.",
  },
  integrations: {
    title: "Integrações",
    description: "Conexões que mantêm o Console em funcionamento.",
  },
  notifications: {
    title: "Avisos de chamados",
    description: "Destinatários e histórico das notificações da operação.",
  },
};

/** Both the intercepted route and its direct URL enforce the same server access. */
export async function PreferencesPage({
  section,
  intercepted = false,
}: {
  section: PreferenceSection;
  intercepted?: boolean;
}) {
  const actor = await (section === "account" ? getActor() : requireAdmin());
  return (
    <PreferencesDialog
      key={section}
      section={section}
      {...copy[section]}
      admin={actor.admin}
      intercepted={intercepted}
    >
      {section === "account" ? (
        <AccountContent />
      ) : section === "integrations" ? (
        <IntegrationsContent />
      ) : (
        <NotificationsContent />
      )}
    </PreferencesDialog>
  );
}
