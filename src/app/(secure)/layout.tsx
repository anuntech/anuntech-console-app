import { getActor, allowedIds } from "@/lib/access";
import { WorkspaceHeader } from "@/components/sidebar";
import { redirect } from "next/navigation";
import { canManageMembers } from "@/lib/member-access";
import { ActionForm } from "@/components/action-form";
import { endAssistedSession } from "@/lib/assisted-actions";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getActor();
  if (!actor.admin && !actor.grants.length && !actor.assisting)
    redirect("/acesso-pendente");
  return (
    <>
      {actor.assisting && (
        <div className="assist-banner" role="status">
          <span>
            Modo assistido: você está vendo o Console como{" "}
            <strong>{actor.assisting.name}</strong>.
          </span>
          <ActionForm
            action={endAssistedSession}
            className="compact-form"
            label="Sair do modo assistido"
            confirm={false}
          >
            {null}
          </ActionForm>
        </div>
      )}
      <div className="console-shell">
        <div className="workspace">
          <WorkspaceHeader
            userName={actor.user.name}
            userImage={actor.user.image ?? null}
            canManageMembers={canManageMembers(actor)}
            admin={actor.admin}
            support={!!allowedIds(actor, "support").length}
            finance={!!allowedIds(actor, "finance").length}
          />
          <main className="page-content" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
