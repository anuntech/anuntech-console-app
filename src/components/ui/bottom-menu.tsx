"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  Plus,
  X,
  LayoutDashboard,
  Building2,
  Layers3,
  MessagesSquare,
  ReceiptText,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { useAppearance } from "@/components/appearance-provider";
import { DockAccountMenu } from "./dock-account-menu";
import styles from "./bottom-menu.module.css";

export type NavigationProps = {
  admin: boolean;
  support: boolean;
  finance: boolean;
  userName: string;
  userImage: string | null;
  canManageMembers: boolean;
};
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
];

const desktopDockQuery = "(min-width: 641px)";
function subscribeDockViewport(onChange: () => void) {
  const query = window.matchMedia(desktopDockQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getDesktopDock = () => window.matchMedia(desktopDockQuery).matches;
const getServerDesktopDock = () => false;

function DockLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  const { position } = useAppearance();
  const desktop = useSyncExternalStore(subscribeDockViewport, getDesktopDock, getServerDesktopDock);
  const side = !desktop ? "top" : position === "left" ? "right" : position === "right" ? "left" : position === "top" ? "bottom" : "top";
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<Link href={href} />}
        className={styles.link}
        aria-label={label}
        aria-current={active ? "page" : undefined}
      >
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner
          side={side}
          sideOffset={9}
          collisionPadding={12}
          className={styles.tooltipPositioner}
        >
          <Tooltip.Popup className={styles.tooltip}>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** Adapted from the supplied BottomMenu, with real Console routes and accessible popovers. */
export default function BottomMenu({
  admin,
  support,
  finance,
  userName,
  userImage,
  canManageMembers,
}: NavigationProps) {
  const pathname = usePathname();
  const { position } = useAppearance();
  const visible = items.filter(
    (item) =>
      (!item.admin || admin) &&
      (!item.area || admin || (item.area === "support" ? support : finance)),
  );
  return (
    <header className={styles.headerBar}>
      <div className={styles.floating}>
        <Tooltip.Provider delay={350} closeDelay={100}>
          <nav className={styles.dock} aria-label="Navegação principal">
            {(admin || support) && (
              <Popover.Root key={`create:${pathname}`}>
                <Popover.Trigger
                  className={`${styles.link} ${styles.create}`}
                  aria-label="Criar"
                  title="Criar"
                >
                  <Plus size={22} strokeWidth={1.8} aria-hidden="true" />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner
                    side={position === "top" ? "bottom" : position === "left" ? "right" : position === "right" ? "left" : "top"}
                    sideOffset={12}
                    collisionPadding={12}
                    className={styles.panelPositioner}
                  >
                    <Popover.Popup className={styles.panel}>
                      <div className={styles.panelHeader}>
                        <Popover.Title className={styles.panelTitle}>
                          Criar
                        </Popover.Title>
                        <Popover.Close
                          className={styles.panelClose}
                          aria-label="Fechar atalhos"
                        >
                          <X size={16} aria-hidden="true" />
                        </Popover.Close>
                      </div>
                      {[
                        {
                          href: "/chamados/novo",
                          label: "Abrir chamado",
                          icon: MessagesSquare,
                          allowed: admin || support,
                        },
                        {
                          href: "/financeiro/nova",
                          label: "Nova cobrança",
                          icon: ReceiptText,
                          allowed: admin,
                        },
                        {
                          href: "/contratos/novo",
                          label: "Novo contrato",
                          icon: FileText,
                          allowed: admin,
                        },
                        {
                          href: "/empresas/nova",
                          label: "Cadastrar empresa",
                          icon: Building2,
                          allowed: admin,
                        },
                      ]
                        .filter((item) => item.allowed)
                        .map(({ href, label, icon: Icon }) => (
                          <Link
                            key={href}
                            href={href}
                            className={styles.panelLink}
                          >
                            <Icon size={19} aria-hidden="true" />
                            <span>{label}</span>
                          </Link>
                        ))}
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            )}
            <div className={styles.routes}>
              {visible.map((item) => (
                <DockLink
                  key={item.href}
                  {...item}
                  active={
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/")
                  }
                />
              ))}
            </div>
            <span className={styles.divider} aria-hidden="true" />
            <DockAccountMenu key={`account:${pathname}`} name={userName} image={userImage} canManageMembers={canManageMembers} />
          </nav>
        </Tooltip.Provider>
      </div>
    </header>
  );
}
