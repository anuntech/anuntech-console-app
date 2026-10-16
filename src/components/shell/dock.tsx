"use client";
import Link from "next/link";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  LayoutDashboard,
  Building2,
  Route,
  FolderKanban,
  Package,
  Headset,
  ReceiptText,
  Folders,
  Bookmark,
  Calculator,
  type LucideIcon,
} from "lucide-react";
import { useAppearance } from "@/components/shell/appearance-provider";
import { DockAccountMenu } from "./dock-account-menu";
import { MobileTabBar } from "./mobile-tab-bar";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { AiOrb } from "@/components/ui/ai-orb";
import { ACTIVITY_LABELS, activityBusy, type AssistantActivity } from "@/lib/assistant/activity";
import styles from "./dock.module.css";
import { OPEN_ASSISTANT_EVENT } from "./assistant-events";

export type NavigationProps = {
  admin: boolean;
  support: boolean;
  finance: boolean;
  userName: string;
  userImage: string | null;
  canManageMembers: boolean;
  /** The assistant's microphone (lib/voice). */
  voice: boolean;
};
const items = [
  { href: "/painel", label: "Visão geral", short: "Início", icon: LayoutDashboard },
  { href: "/empresas", label: "Empresas", icon: Building2, admin: true },
  { href: "/jornadas", label: "Jornadas", icon: Route, admin: true },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/produtos", label: "Produtos e serviços", short: "Produtos", icon: Package },
  {
    href: "/chamados",
    label: "Chamados",
    icon: Headset,
    area: "support",
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: ReceiptText,
    area: "finance",
  },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/orcamentos", label: "Orçamentos", icon: Calculator, area: "finance" },
  { href: "/contratos", label: "Contratos", icon: Folders, area: "finance" },
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

/** The Console's dock: real routes, the viewer's permissions and accessible popovers. */
export function Dock({
  admin,
  support,
  finance,
  userName,
  userImage,
  canManageMembers,
  voice,
}: NavigationProps) {
  const pathname = usePathname();
  const { position } = useAppearance();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantActivity, setAssistantActivity] = useState<AssistantActivity>("idle");
  const assistantBusy = activityBusy(assistantActivity);
  const assistantStatus = useId();
  // Pages open it too ("Perguntar ao assistente" in Ajuda).
  useEffect(() => {
    const open = () => setAssistantOpen(true);
    window.addEventListener(OPEN_ASSISTANT_EVENT, open);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, open);
  }, []);
  const visible = items.filter(
    (item) =>
      (!item.admin || admin) &&
      (!item.area || admin || (item.area === "support" ? support : finance)),
  );
  const actions = [
    {
      href: `/chamados/novo?from=${encodeURIComponent(pathname)}`,
      label: "Abrir chamado",
      icon: Headset,
      allowed: admin || support,
    },
    { href: "/financeiro/nova", label: "Nova cobrança", icon: ReceiptText, allowed: admin },
    { href: "/projetos/novo", label: "Novo projeto", icon: FolderKanban, allowed: admin },
    { href: "/produtos/novo", label: "Vincular produto ou serviço", icon: Package, allowed: admin },
    { href: "/orcamentos/novo", label: "Novo orçamento", icon: Calculator, allowed: admin },
    { href: "/contratos/novo", label: "Novo contrato", icon: Folders, allowed: admin },
    { href: "/empresas/nova", label: "Cadastrar empresa", icon: Building2, allowed: admin },
    { href: "/jornadas/nova", label: "Nova jornada", icon: Route, allowed: admin },
  ].filter((item) => item.allowed);
  return (
    <header className={styles.headerBar}>
      <MobileTabBar
        pathname={pathname}
        visible={visible}
        actions={actions}
        admin={admin}
        userName={userName}
        userImage={userImage}
        canManageMembers={canManageMembers}
        onAssistant={() => setAssistantOpen(true)}
        assistantActivity={assistantActivity}
      />
      <AssistantPanel
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        onActivityChange={setAssistantActivity}
        admin={admin}
        finance={finance}
        support={support}
        userName={userName}
        shortcuts={[...actions.map(({ href, label }) => ({ href, label })), { href: "/ajuda", label: "Ajuda" }]}
        voice={voice}
      />
      <div className={styles.floating}>
        <Tooltip.Provider delay={350} closeDelay={100}>
          <nav className={styles.dock} aria-label="Navegação principal">
            <Tooltip.Root>
              <Tooltip.Trigger
                render={<button type="button" className={styles.assistant} onClick={() => setAssistantOpen(true)} />}
                aria-label="Assistente"
                aria-haspopup="dialog"
                aria-expanded={assistantOpen}
                aria-busy={assistantBusy}
                aria-describedby={assistantActivity === "idle" ? undefined : assistantStatus}
              >
                {/* The orb mirrors the assistant: still at rest, a different motion for each
                    step of a turn, and how the last answer ended until it is seen. */}
                <AiOrb state={assistantActivity} size="md" decorative />
                {/* What the orb shows, for screen readers too (the tooltip only shows on hover or focus). */}
                <span id={assistantStatus} className="sr-only">
                  {ACTIVITY_LABELS[assistantActivity]}
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner
                  side={position === "top" ? "bottom" : position === "left" ? "right" : position === "right" ? "left" : "top"}
                  sideOffset={9}
                  collisionPadding={12}
                  className={styles.tooltipPositioner}
                >
                  <Tooltip.Popup className={styles.tooltip}>{ACTIVITY_LABELS[assistantActivity]}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
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
