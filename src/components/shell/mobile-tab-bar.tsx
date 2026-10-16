"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
  EllipsisIcon,
  LogOutIcon,
  MessageCircleQuestionIcon,
  PaletteIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon, LifeBuoyIcon } from "lucide-react";
import { cn } from "cn";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { authClient } from "@/lib/auth/auth-client";
import { isCatalogAvatar } from "@/lib/account/avatar-catalog";
import { IllustratedAvatar, profileAvatarSource } from "@/components/settings/illustrated-avatar";
import { toast } from "@/components/shell/notifications";
import { openSupportWidget } from "@/components/shell/support-trigger";
import { splitTabs, type TabEntry } from "@/lib/mobile-tabs";
import { AiOrb } from "@/components/ui/ai-orb";
import { ACTIVITY_LABELS, type AssistantActivity } from "@/lib/assistant/activity";
import styles from "./dock.module.css";

export type TabItem = TabEntry<LucideIcon>;
export type TabAction = { href: string; label: string; icon: LucideIcon };

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

function Row({
  icon: Icon,
  children,
  className,
  ...props
}: { icon: LucideIcon; children: ReactNode; className?: string } & (
  | { href: string; onClick?: () => void }
  | { href?: undefined; onClick: () => void; disabled?: boolean }
)) {
  const inner = (
    <>
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );
  const base = cn(
    "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-foreground transition-colors active:bg-accent",
    className,
  );
  if (props.href)
    return (
      <Link href={props.href} onClick={props.onClick} className={base}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={props.onClick} disabled={"disabled" in props ? props.disabled : false} className={base}>
      {inner}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="m-0 px-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The phone navigation: four tabs with labels and a "Mais" sheet that
 * gathers the other areas, the create shortcuts and the account items.
 * Hidden on wider screens, where the floating dock takes over.
 */
export function MobileTabBar({
  pathname,
  visible,
  actions,
  admin,
  userName,
  userImage,
  canManageMembers,
  onAssistant,
  assistantActivity,
}: {
  pathname: string;
  visible: TabItem[];
  actions: TabAction[];
  admin: boolean;
  userName: string;
  userImage: string | null;
  canManageMembers: boolean;
  onAssistant: () => void;
  /** What the assistant is doing: phones have no dock, so the sheet's row says it. */
  assistantActivity: AssistantActivity;
}) {
  const router = useRouter();
  // The sheet remembers where it was opened: navigating (rows, back/forward) closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean) => setOpenedOn(next ? pathname : null);
  const [signingOut, setSigningOut] = useState(false);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const lock = useRef(false);
  const { primary, rest } = splitTabs(visible, admin);
  const restActive = rest.some((item) => isActive(pathname, item.href));
  const source = profileAvatarSource(userImage);
  const initials = userName
    .trim()
    .split(/\s+/)
    .filter((_, i, parts) => i === 0 || i === parts.length - 1)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
  const close = () => setOpen(false);
  const signOut = async () => {
    if (lock.current) return;
    lock.current = true;
    setSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw Error();
      setOpen(false);
      router.replace("/entrar");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
      setSigningOut(false);
      lock.current = false;
    }
  };
  return (
    <>
      <nav className={styles.tabbar} aria-label="Navegação principal">
        <div className={styles.tabbarInner}>
          {primary.map(({ href, label, short, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(styles.tab, active && styles.tabActive)}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                <span>{short ?? label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={cn(styles.tab, (restActive || open) && styles.tabActive)}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <EllipsisIcon size={22} strokeWidth={restActive ? 2.2 : 1.8} aria-hidden="true" />
            <span>Mais</span>
          </button>
        </div>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[88svh] gap-0 overflow-y-auto rounded-t-2xl px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]"
        >
          <div aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
          <SheetHeader className="flex-row items-center gap-3 px-3 py-3 text-left">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-primary">
              {source && isCatalogAvatar(userImage) ? (
                <IllustratedAvatar image={source} size={40} />
              ) : source && failedSource !== source ? (
                <Image src={source} alt="" width={40} height={40} unoptimized onError={() => setFailedSource(source)} />
              ) : (
                initials || <UserRoundIcon size={20} aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">{userName}</SheetTitle>
              <SheetDescription className="text-xs">Atalhos, outras áreas e sua conta.</SheetDescription>
            </div>
          </SheetHeader>
          <div className="flex flex-col gap-5 pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTimeout(onAssistant, 250);
              }}
              className="flex h-12 items-center gap-3 rounded-xl bg-primary px-4 text-left text-sm font-medium text-primary-foreground active:opacity-90"
            >
              {/* On the primary row the orb takes the row's text colour. */}
              <AiOrb state={assistantActivity} size="sm" decorative colorToken="--primary-foreground" />
              <span className="min-w-0 flex-1">
                Perguntar ao assistente
                {assistantActivity !== "idle" && (
                  <span className="block truncate text-xs font-normal opacity-80">{ACTIVITY_LABELS[assistantActivity]}</span>
                )}
              </span>
            </button>
            {actions.length > 0 && (
              <Section title="Criar">
                {actions.map(({ href, label, icon }) => (
                  <Row key={href} href={href} icon={icon} onClick={close}>
                    {label}
                  </Row>
                ))}
              </Section>
            )}
            {rest.length > 0 && (
              <Section title="Mais áreas">
                {rest.map(({ href, label, icon }) => (
                  <Row
                    key={href}
                    href={href}
                    icon={icon}
                    onClick={close}
                    className={cn(isActive(pathname, href) && "bg-accent font-medium text-primary")}
                  >
                    {label}
                  </Row>
                ))}
              </Section>
            )}
            <Section title="Conta">
              <Row href="/conta" icon={UserRoundIcon} onClick={close}>
                Meu perfil
              </Row>
              <Row href="/configuracoes/aparencia" icon={PaletteIcon} onClick={close}>
                Aparência
              </Row>
              {canManageMembers && (
                <Row href="/configuracoes/membros" icon={UsersIcon} onClick={close}>
                  Membros
                </Row>
              )}
              <Row href="/ajuda" icon={LifeBuoyIcon} onClick={close}>
                Ajuda
              </Row>
              <Row
                icon={MessageCircleQuestionIcon}
                onClick={() => {
                  setOpen(false);
                  setTimeout(openSupportWidget, 250);
                }}
              >
                Conversar com a equipe
              </Row>
              <Row icon={LogOutIcon} onClick={signOut} disabled={signingOut} className="text-destructive">
                {signingOut ? "Saindo…" : "Sair"}
              </Row>
            </Section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
