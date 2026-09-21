import "server-only";
import { getActor, requireAdmin } from "@/lib/access";
import { canManageMembers, requireMemberManager } from "@/lib/member-access";
import { CompanyContent } from "./company-content";
import { AccountContent } from "./account-content";
import { IntegrationsContent } from "./integrations-content";
import { NotificationsContent } from "./notifications-content";
import { MembersContent } from "./members-content";
import {
  PreferencesDialog,
  type PreferenceSection,
} from "./preferences-dialog";

const copy = {
  company: {
    title: "Dados da empresa",
    description: "Cadastro e preferências de comunicação por assunto.",
  },
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
    title: "Notificações",
    description: "Contatos e canais de recebimento, separados por assunto.",
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
    : section === "members" || section === "company"
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
      {section === "company" ? (
        <CompanyContent />
      ) : section === "account" ? (
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
