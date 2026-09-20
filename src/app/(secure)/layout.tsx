import { getActor, allowedIds } from "@/lib/access";
import { WorkspaceHeader } from "@/components/sidebar";
import { redirect } from "next/navigation";
import { PreferencesNavigationProvider } from "@/components/preferences/preferences-dialog";
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
      <div className="console-shell">
        <div className="workspace">
          <WorkspaceHeader
            admin={actor.admin}
            support={!!allowedIds(actor, "support").length}
            finance={!!allowedIds(actor, "finance").length}
          />
          <main className="page-content" id="main-content" tabIndex={-1}>
            {children}
          </main>
          <footer className="app-footer">Anuntech Console</footer>
        </div>
        {preferences}
      </div>
    </PreferencesNavigationProvider>
  );
}
