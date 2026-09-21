import "server-only";
import { getActor, requireAdmin } from "@/lib/access";
import { canManageMembers, requireMemberManager } from "@/lib/member-access";
import { AccountContent } from "./account-content";
import { IntegrationsContent } from "./integrations-content";
import { NotificationsContent } from "./notifications-content";
import { MembersContent } from "./members-content";
import {
  PreferencesDialog,
  type PreferenceSection,
} from "./preferences-dialog";

const copy = {
  account: {
    title: "Minha conta",
    description: "Seu perfil, contatos e segurança de acesso.",
  },
  members: {
    title: "Membros",
    description: "Pessoas da equipe e acessos às empresas.",
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
  const actor = await (section === "account"
    ? getActor()
    : section === "members"
      ? requireMemberManager()
      : requireAdmin());
  return (
    <PreferencesDialog
      key={section}
      section={section}
      {...copy[section]}
      description={
        section === "members" && !actor.admin
          ? "Pessoas e permissões das empresas que você administra."
          : copy[section].description
      }
      admin={actor.admin}
      canManageMembers={canManageMembers(actor)}
      userName={actor.user.name}
      userImage={actor.user.image ?? null}
      intercepted={intercepted}
    >
      {section === "account" ? (
        <AccountContent />
      ) : section === "integrations" ? (
        <IntegrationsContent />
      ) : section === "members" ? (
        <MembersContent />
      ) : (
        <NotificationsContent />
      )}
    </PreferencesDialog>
  );
}
