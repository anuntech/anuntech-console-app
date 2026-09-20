"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  LayoutDashboard,
  Building2,
  Layers3,
  MessagesSquare,
  ReceiptText,
  Settings2,
  FileText,
  type LucideIcon,
} from "lucide-react";
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
];

function DockLink({
  href,
  label,
  icon: Icon,
  active,
  preferences = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  preferences?: boolean;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        id={preferences ? "console-menu-trigger" : undefined}
        render={<Link href={href} />}
        className={styles.link}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        aria-haspopup={preferences ? "dialog" : undefined}
      >
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner
          side="bottom"
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

/** Dock composition from shadcn.io, using semantic links and Base UI tooltips. */
export function WorkspaceHeader({ admin, support, finance }: NavigationProps) {
  const pathname = usePathname();
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
            <DockLink
              href="/conta"
              label="Ajustes"
              icon={Settings2}
              preferences
              active={
                pathname === "/conta" ||
                pathname === "/configuracoes" ||
                pathname.startsWith("/configuracoes/")
              }
            />
          </nav>
        </Tooltip.Provider>
      </div>
    </header>
  );
}
