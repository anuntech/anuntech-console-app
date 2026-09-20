"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
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
  X,
} from "lucide-react";
import { SignOutButton } from "./auth-buttons";
import styles from "./navigation.module.css";

type NavigationProps = { admin: boolean; support: boolean; finance: boolean };
const items = [
  { href: "/painel", label: "Visão geral", icon: LayoutDashboard },
  { href: "/empresas", label: "Empresas", icon: Building2, admin: true },
  { href: "/produtos", label: "Produtos e projetos", icon: Layers3 },
  {
    href: "/chamados",
    label: "Chamados",
    icon: MessagesSquare,
    area: "support",
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: ReceiptText,
    area: "finance",
  },
  { href: "/contratos", label: "Contratos", icon: FileText, area: "finance" },
  { href: "/conta", label: "Minha conta", icon: UserRound, preferences: true },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings2,
    admin: true,
    preferences: true,
  },
];

function FloatingNavigation({ admin, support, finance }: NavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigating = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const visible = items.filter(
    (item) =>
      (!item.admin || admin) &&
      (!item.area || admin || (item.area === "support" ? support : finance)),
  );
  return (
    <div className={styles.floating}>
      <Popover.Root
        open={open}
        modal="trap-focus"
        onOpenChange={(nextOpen) => {
          if (nextOpen) navigating.current = false;
          setOpen(nextOpen);
        }}
      >
        <Popover.Trigger
          id="console-menu-trigger"
          ref={trigger}
          className={styles.trigger}
          aria-label="Abrir menu"
          title="Menu"
        >
          <Menu size={21} strokeWidth={1.8} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            align="end"
            sideOffset={8}
            collisionPadding={12}
            className={styles.positioner}
          >
            <Popover.Popup
              className={styles.popup}
              finalFocus={() => (navigating.current ? false : trigger.current)}
            >
              <div className={styles.header}>
                <Popover.Title className={styles.title}>Menu</Popover.Title>
                <Popover.Close
                  className={styles.close}
                  aria-label="Fechar menu"
                >
                  <X size={17} aria-hidden="true" />
                </Popover.Close>
              </div>
              <Popover.Description className="sr-only">
                Navegue pelas áreas do Console ou abra suas preferências.
              </Popover.Description>
              <nav aria-label="Navegação principal">
                {[false, true].map((preferences) => (
                  <div key={String(preferences)} className={styles.group}>
                    {visible
                      .filter(
                        (item) => Boolean(item.preferences) === preferences,
                      )
                      .map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={styles.link}
                          aria-current={
                            pathname === item.href ||
                            pathname.startsWith(item.href + "/")
                              ? "page"
                              : undefined
                          }
                          onNavigate={() => {
                            navigating.current = true;
                            setOpen(false);
                          }}
                        >
                          <item.icon
                            size={17}
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                          <span>{item.label}</span>
                        </Link>
                      ))}
                  </div>
                ))}
              </nav>
              <div className={styles.footer}>
                <SignOutButton />
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <noscript>
        <style>{"#console-menu-trigger { display: none; }"}</style>
        <details className={styles.fallback}>
          <summary>Menu</summary>
          <nav aria-label="Navegação principal">
            {visible.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </details>
      </noscript>
    </div>
  );
}

export function WorkspaceHeader(props: NavigationProps) {
  const pathname = usePathname();
  const current = items.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
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
    <header className={styles.headerBar}>
      <nav className="breadcrumb" aria-label="Localização">
        <ol>
          {detail && current ? (
            <>
              <li>
                <Link href={current.href}>{current.label}</Link>
                <ChevronRight size={14} aria-hidden="true" />
              </li>
              <li>
                <span aria-current="page">{detail}</span>
              </li>
            </>
          ) : (
            <li>
              <span aria-current="page">{current?.label || "Visão geral"}</span>
            </li>
          )}
        </ol>
      </nav>
      <FloatingNavigation key={pathname} {...props} />
    </header>
  );
}
