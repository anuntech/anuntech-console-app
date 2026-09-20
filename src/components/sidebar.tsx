"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Layers3,
  MessagesSquare,
  ReceiptText,
  Settings2,
  UserRound,
  FileText,
  Menu,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Brand } from "./brand";
import { SignOutButton } from "./auth-buttons";

type NavigationProps = { admin: boolean; support: boolean; finance: boolean };
const items = [
  {
    href: "/painel",
    label: "Visão geral",
    icon: LayoutDashboard,
    group: "Workspace",
  },
  {
    href: "/empresas",
    label: "Empresas",
    icon: Building2,
    admin: true,
    group: "Workspace",
  },
  {
    href: "/produtos",
    label: "Produtos e projetos",
    icon: Layers3,
    group: "Workspace",
  },
  {
    href: "/chamados",
    label: "Chamados",
    icon: MessagesSquare,
    area: "support",
    group: "Operação",
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: ReceiptText,
    area: "finance",
    group: "Operação",
  },
  {
    href: "/contratos",
    label: "Contratos",
    icon: FileText,
    area: "finance",
    group: "Operação",
  },
  {
    href: "/conta",
    label: "Minha conta",
    icon: UserRound,
    group: "Preferências",
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings2,
    admin: true,
    group: "Preferências",
  },
];
export function Sidebar({
  admin,
  support,
  finance,
  onNavigate,
}: NavigationProps & { onNavigate?: () => void }) {
  const path = usePathname();
  const visible = items.filter(
    (i) =>
      (!i.admin || admin) &&
      (!i.area || (i.area === "support" ? support : finance) || admin),
  );
  return (
    <nav aria-label="Navegação principal" className="sidebar-navigation">
      {["Workspace", "Operação", "Preferências"].map((group) => {
        const links = visible.filter((i) => i.group === group);
        return links.length ? (
          <div className="nav-group" key={group}>
            <p className="nav-caption">
              {group === "Workspace"
                ? admin
                  ? "Seu espaço"
                  : "Sua empresa"
                : group}
            </p>
            {links.map((i) => {
              const active = path === i.href || path.startsWith(i.href + "/");
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={onNavigate}
                  className={`nav-link${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <i.icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{i.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null;
      })}
    </nav>
  );
}
export function WorkspaceHeader({ admin, support, finance }: NavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = items.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  const suffix = pathname.split("/").filter(Boolean).slice(1);
  const detail = suffix.length
    ? {
        nova: "Novo cadastro",
        novo: "Novo cadastro",
        convites: "Convites",
        envios: "Envios",
        notificacoes: "Avisos de chamados",
      }[suffix[0]] || "Detalhes"
    : null;
  return (
    <header className="topbar">
      <div className="topbar-start">
        <div className="mobile-menu">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="icon-button" aria-label="Abrir navegação">
              <Menu size={21} aria-hidden="true" />
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Navegação do Console</SheetTitle>
              <SheetDescription className="sr-only">
                Acesse as áreas disponíveis na sua conta.
              </SheetDescription>
              <Brand />
              <Sidebar
                admin={admin}
                support={support}
                finance={finance}
                onNavigate={() => setOpen(false)}
              />
              <div className="mobile-menu-footer">
                <SignOutButton />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <nav className="breadcrumb" aria-label="Localização">
          <ol>
            <li className="breadcrumb-root">
              <Link href="/painel">Console</Link>
              <ChevronRight size={14} aria-hidden="true" />
            </li>
            <li>
              {detail && current ? (
                <>
                  <Link href={current.href}>{current.label}</Link>
                  <ChevronRight size={14} aria-hidden="true" />
                </>
              ) : (
                <span aria-current="page">{current?.label || "Console"}</span>
              )}
            </li>
            {detail && (
              <li>
                <span aria-current="page">{detail}</span>
              </li>
            )}
          </ol>
        </nav>
      </div>
      <span className="topbar-tag">
        <ShieldCheck size={14} aria-hidden="true" />
        {admin ? "Administração" : "Área do cliente"}
      </span>
    </header>
  );
}
