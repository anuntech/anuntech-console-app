import { getActor, allowedIds } from "@/lib/access";
import { Sidebar } from "@/components/sidebar";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/auth-buttons";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getActor();
  if (!actor.admin && !actor.grants.length) redirect("/acesso-pendente");
  return (
    <div className="console-shell">
      <aside className="sidebar">
        <Brand />
        <p className="nav-caption">
          {actor.admin ? "ADMINISTRAÇÃO" : "ÁREA DO CLIENTE"}
        </p>
        <Sidebar
          admin={actor.admin}
          support={!!allowedIds(actor, "support").length}
          finance={!!allowedIds(actor, "finance").length}
        />
        <div className="sidebar-bottom">
          <span className="avatar">
            {actor.user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{actor.user.name}</strong>
            <span>{actor.admin ? "Anuntech" : "Cliente"}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Console <span className="separator">/</span>{" "}
            {actor.admin ? "Administração" : "Portal do cliente"}
          </span>
          <span className="topbar-tag">
            {actor.admin ? "Acesso interno" : "Acesso da empresa"}
          </span>
          <div className="mobile-signout">
            <SignOutButton />
          </div>
        </header>
        <main className="page-content">{children}</main>
        <footer className="app-footer">Anuntech Console</footer>
      </div>
    </div>
  );
}
