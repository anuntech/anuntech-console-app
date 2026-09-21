import { getActor, allowedIds } from "@/lib/access";
import { WorkspaceHeader } from "@/components/sidebar";
import { redirect } from "next/navigation";
import { canManageMembers } from "@/lib/member-access";
import {
  PreferencesNavigationProvider,
  PreferencesWorkspace,
} from "@/components/preferences/preferences-dialog";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function ConsoleLayout({
  children,
  preferences,
}: {
  children: React.ReactNode;
  preferences: React.ReactNode;
}) {
  const actor = await getActor();
  if (!actor.admin && !actor.grants.length) redirect("/acesso-pendente");
  return (
    <PreferencesNavigationProvider>
      <PreferencesWorkspace
        admin={actor.admin}
        canManageMembers={canManageMembers(actor)}
        userName={actor.user.name}
        userImage={actor.user.image ?? null}
        preferences={preferences}
        header={
          <WorkspaceHeader
            userName={actor.user.name}
            userImage={actor.user.image ?? null}
            canManageMembers={canManageMembers(actor)}
            admin={actor.admin}
            support={!!allowedIds(actor, "support").length}
            finance={!!allowedIds(actor, "finance").length}
          />
        }
      >
        {children}
      </PreferencesWorkspace>
    </PreferencesNavigationProvider>
  );
}
