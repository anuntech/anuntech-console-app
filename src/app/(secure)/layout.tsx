import { getActor, allowedIds } from "@/lib/access";
import { Sidebar, WorkspaceHeader } from "@/components/sidebar";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/auth-buttons";
import { redirect } from "next/navigation";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getActor();
  if (!actor.admin && !actor.grants.length) redirect("/acesso-pendente");
  return (
    <div className="console-shell">
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <Link
          className="brand-link"
          href="/painel"
          aria-label="Console, visão geral"
        >
          <Brand />
        </Link>
        <Sidebar
          admin={actor.admin}
          support={!!allowedIds(actor, "support").length}
          finance={!!allowedIds(actor, "finance").length}
        />
        <div className="sidebar-bottom">
          <Link className="sidebar-profile" href="/conta">
            <span className="avatar" aria-hidden="true">
              {actor.user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{actor.user.name}</strong>
              <span>{actor.admin ? "Anuntech" : "Cliente"}</span>
            </div>
          </Link>
          <SignOutButton />
        </div>
      </aside>
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
    </div>
  );
}
