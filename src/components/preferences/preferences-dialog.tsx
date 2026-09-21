"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  usePathname,
  useRouter,
  useSelectedLayoutSegments,
} from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Building2, Bell, PlugZap, UserRound, Users, X, Palette, ShieldCheck } from "lucide-react";
import { IllustratedAvatar } from "./illustrated-avatar";
import { isCatalogAvatar } from "@/lib/avatar-catalog";
import { profileAvatarSource } from "./profile-avatar";
import { SignOutButton } from "@/components/auth-buttons";
import { preferenceCopy } from "./preferences-copy";
import styles from "./preferences-dialog.module.css";

export type PreferenceSection =
  "appearance" | "security" | "account" | "company" | "members" | "integrations" | "notifications";
const sections = {
  appearance: { href: "/configuracoes/aparencia", label: "Aparência", icon: Palette },
  security: { href: "/configuracoes/seguranca", label: "Segurança", icon: ShieldCheck },
  company: {
    href: "/configuracoes/empresa",
    label: "Dados da empresa",
    icon: Building2,
  },
  account: { href: "/conta", label: "Minha conta", icon: UserRound },
  members: { href: "/configuracoes/membros", label: "Membros", icon: Users },
  integrations: { href: "/configuracoes", label: "Integrações", icon: PlugZap },
  notifications: {
    href: "/configuracoes/notificacoes",
    label: "Notificações",
    icon: Bell,
  },
};
const isPreferencePath = (pathname: string) =>
  Object.values(sections).some(({ href }) => href === pathname);
const isPreferenceTitle = (title: string) =>
  Object.values(sections).some(
    ({ label }) => title === `${label} | Anuntech Console`,
  );
const NavigationContext = createContext({
  directEntry: false,
  intercepted: false,
});
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Keeps a direct entry's safe close destination while switching modal sections. */
export function PreferencesNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const segments = useSelectedLayoutSegments("preferences");
  const backgroundSegments = useSelectedLayoutSegments();
  const backgroundPath = `/${backgroundSegments
    .filter((segment) => !segment.startsWith("(") && !segment.startsWith("__"))
    .join("/")}`;
  const directEntry = isPreferencePath(backgroundPath);
  const previousPath = useRef(pathname);
  const restoreMenuFocus = useRef(false);
  const pageTitles = useRef(
    new Map([["/painel", "Visão geral | Anuntech Console"]]),
  );
  const managedTitle = useRef<{
    title: string;
    backgroundPath: string;
  } | null>(null);
  useLayoutEffect(() => {
    const section = Object.values(sections).find(
      ({ href }) => href === pathname,
    );
    let syncTitle: () => void;
    if (section) {
      restoreMenuFocus.current = false;
      const title = `${section.label} | Anuntech Console`;
      // Browser Back can restore an older modal over a different retained page
      // than the page just visited. The children slot, not the last URL, is its origin.
      const origin = directEntry ? "/painel" : backgroundPath;
      if (
        !directEntry &&
        !pageTitles.current.has(origin) &&
        !isPreferenceTitle(document.title)
      ) {
        pageTitles.current.set(origin, document.title);
      }
      managedTitle.current = { title, backgroundPath: origin };
      // The retained page can win Next's parallel-route metadata merge. Set the
      // active title before Next's existing route announcer reads it (useEffect).
      syncTitle = () => {
        if (document.title !== title) document.title = title;
      };
    } else {
      const managed = managedTitle.current;
      const returningToOrigin = managed?.backgroundPath === pathname;
      restoreMenuFocus.current = returningToOrigin;
      managedTitle.current = null;
      syncTitle = () => {
        const currentTitle = document.title;
        if (isPreferenceTitle(currentTitle)) {
          const previousTitle = pageTitles.current.get(pathname);
          if (returningToOrigin && previousTitle)
            document.title = previousTitle;
        } else if (currentTitle.trim()) {
          pageTitles.current.set(pathname, currentTitle);
        }
      };
    }
    syncTitle();
    // Next can commit streamed head metadata after the route layout effect.
    // Observe only this route, without adding a second live announcement.
    const observer = new MutationObserver(() => {
      if (window.location.pathname === pathname) syncTitle();
    });
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    // A different destination owns its metadata; cleanup never writes a title.
    return () => observer.disconnect();
  }, [pathname, backgroundPath, directEntry]);
  useEffect(() => {
    const returning =
      isPreferencePath(previousPath.current) && !isPreferencePath(pathname);
    previousPath.current = pathname;
    const shouldRestore = restoreMenuFocus.current;
    restoreMenuFocus.current = false;
    if (!returning || !shouldRestore) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById("console-menu-trigger")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <NavigationContext.Provider
      value={{
        directEntry,
        // Direct entries use the default slot; intercepted segments retain their marker.
        intercepted: segments.some((segment) => segment.startsWith("(.)")),
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

/** The dialog belongs to the persistent layout, not to a replaceable route page. */
export function PreferencesWorkspace({
  children,
  preferences,
  header,
  admin,
  canManageMembers,
  userName,
  userImage,
}: {
  children: ReactNode;
  preferences: ReactNode;
  header: ReactNode;
  admin: boolean;
  canManageMembers: boolean;
  userName: string;
  userImage: string | null;
}) {
  const pathname = usePathname();
  const navigation = useContext(NavigationContext);
  const section = (Object.keys(sections) as PreferenceSection[]).find(
    (key) => sections[key].href === pathname,
  );
  return (
    <div className="console-shell">
      <div className="workspace">
        {header}
        <main className="page-content" id="main-content" tabIndex={-1}>
          {navigation.directEntry ? (
            <div className={styles.background} />
          ) : (
            children
          )}
        </main>
        <footer className="app-footer">Anuntech Console</footer>
      </div>
      {section && (
        <PreferencesDialog
          section={section}
          {...preferenceCopy[section]}
          description={
            section === "members" && !admin
              ? "Pessoas do seu ambiente."
              : preferenceCopy[section].description
          }
          admin={admin}
          canManageMembers={canManageMembers}
          userName={userName}
          userImage={userImage}
          intercepted={navigation.intercepted}
        >
          {navigation.intercepted ? preferences : children}
        </PreferencesDialog>
      )}
    </div>
  );
}

export function PreferencesDialog({
  section,
  title,
  description,
  admin,
  canManageMembers,
  userName,
  userImage,
  intercepted = false,
  children,
}: {
  section: PreferenceSection;
  title: string;
  description: string;
  admin: boolean;
  canManageMembers: boolean;
  userName: string;
  userImage: string | null;
  intercepted?: boolean;
  children: ReactNode;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useContext(NavigationContext);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [section]);
  const sectionPath = sections[section].href;
  const visible =
    pathname === sectionPath && (intercepted || !navigation.intercepted);
  const close = () => {
    if (!intercepted || navigation.directEntry) router.replace("/painel");
    else router.back();
  };
  const initials = userName
    .trim()
    .split(/\s+/)
    .filter((_, index, parts) => index === 0 || index === parts.length - 1)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
  const closeControl = hydrated ? (
    <Dialog.Close className={styles.close} aria-label="Fechar ajustes">
      <X size={16} aria-hidden="true" />
    </Dialog.Close>
  ) : (
    <Link href="/painel" className={styles.close} aria-label="Fechar ajustes">
      <X size={16} aria-hidden="true" />
    </Link>
  );
  const sidebar = (
    <aside className={styles.sidebar}>
      <nav className={styles.navigation} aria-label="Categorias dos ajustes">
        <Link
          href="/conta"
          replace
          scroll={false}
          className={styles.profileLink}
        >
          <span className={styles.avatar} aria-hidden="true">
            {userImage && isCatalogAvatar(userImage) ? (
              <IllustratedAvatar image={userImage} size={42} />
            ) : profileAvatarSource(userImage) ? (
              <Image
                src={profileAvatarSource(userImage)!}
                alt=""
                width={42}
                height={42}
                unoptimized
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "50%",
                }}
              />
            ) : (
              initials
            )}
          </span>
          <span className={styles.profileText}>
            <strong>{userName}</strong>
            <span>Minha conta</span>
          </span>
        </Link>
        <div className={styles.category}>
          <p className={styles.categoryTitle}>Usuário</p>
          <div className={styles.categoryLinks}>
            {(["account", "appearance", "security"] as const).map(item => {
              const { href, label, icon: Icon } = sections[item];
              return <Link key={item} href={href} replace scroll={false} className={styles.navLink} aria-current={section === item ? "page" : undefined}>
                <span className={styles.categoryIcon}><Icon size={17} aria-hidden="true" /></span><span>{label}</span>
              </Link>;
            })}
          </div>
        </div>
        {(admin || canManageMembers) && (
          <div className={styles.category}>
            <p className={styles.categoryTitle}>
              Empresa
            </p>
            <div className={styles.categoryLinks}>
              {(admin
                ? ([
                    "company",
                    "members",
                    "notifications",
                    "integrations",
                  ] as const)
                : (["company", "members", "notifications"] as const)
              ).map((item) => {
                const { href, label, icon: Icon } = sections[item];
                return (
                  <Link
                    key={item}
                    href={href}
                    replace
                    scroll={false}
                    className={styles.navLink}
                    aria-current={section === item ? "page" : undefined}
                  >
                    <span className={styles.categoryIcon}>
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
      <div className={styles.sidebarFooter}>
        <SignOutButton />
      </div>
    </aside>
  );
  if (!visible) return null;

  // The server view keeps forms and authorization results in the rendered HTML.
  // Hydration replaces this single view with Base UI's focus-managed dialog.
  if (!hydrated) {
    return (
      <>
        <div className={styles.fallbackBackdrop} aria-hidden="true" />
        <section className={styles.popup} aria-labelledby="preferences-title">
          {closeControl}
          {sidebar}
          <div className={styles.content} ref={contentRef}>
            <header className={styles.header} data-section={section}>
              <h1 id="preferences-title" className={styles.title}>
                {title}
              </h1>
              <p className={styles.description}>{description}</p>
            </header>
            <div className={styles.body}>{children}</div>
          </div>
        </section>
      </>
    );
  }
  return (
    <>
      <Dialog.Root
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.backdrop} />
          <Dialog.Popup
            className={styles.popup}
            initialFocus={titleRef}
            // The provider restores focus only when returning to the background page.
            finalFocus={false}
          >
            {closeControl}
            {sidebar}
            <div className={styles.content} ref={contentRef}>
              <header className={styles.header} data-section={section}>
                <Dialog.Title
                  render={<h1 />}
                  ref={titleRef}
                  className={styles.title}
                  tabIndex={-1}
                >
                  {title}
                </Dialog.Title>
                <Dialog.Description className={styles.description}>
                  {description}
                </Dialog.Description>
              </header>
              <div className={styles.body}>{children}</div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
