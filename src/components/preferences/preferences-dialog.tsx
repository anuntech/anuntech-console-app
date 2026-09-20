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
import {
  usePathname,
  useRouter,
  useSelectedLayoutSegments,
} from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Bell, PlugZap, UserRound, X } from "lucide-react";
import styles from "./preferences-dialog.module.css";

export type PreferenceSection = "account" | "integrations" | "notifications";
const sections = {
  account: { href: "/conta", label: "Minha conta", icon: UserRound },
  integrations: { href: "/configuracoes", label: "Integrações", icon: PlugZap },
  notifications: {
    href: "/configuracoes/notificacoes",
    label: "Avisos de chamados",
    icon: Bell,
  },
};
const isPreferencePath = (pathname: string) =>
  Object.values(sections).some(({ href }) => href === pathname);
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
  const pageTitles = useRef(new Map<string, string>());
  const managedTitle = useRef<{
    title: string;
    backgroundPath: string;
  } | null>(null);
  useLayoutEffect(() => {
    const section = Object.values(sections).find(
      ({ href }) => href === pathname,
    );
    if (section) {
      restoreMenuFocus.current = false;
      const title = `${section.label} | Anuntech Console`;
      // Browser Back can restore an older modal over a different retained page
      // than the page just visited. The children slot, not the last URL, is its origin.
      const origin = directEntry ? "/painel" : backgroundPath;
      const currentTitleIsPreference = Object.values(sections).some(
        ({ label }) => document.title === `${label} | Anuntech Console`,
      );
      if (
        !directEntry &&
        !pageTitles.current.has(origin) &&
        !currentTitleIsPreference
      ) {
        pageTitles.current.set(origin, document.title);
      }
      managedTitle.current = { title, backgroundPath: origin };
      // The retained page can win Next's parallel-route metadata merge. Set the
      // active title before Next's existing route announcer reads it (useEffect).
      document.title = title;
      return;
    }
    const managed = managedTitle.current;
    restoreMenuFocus.current = !!managed && managed.backgroundPath === pathname;
    const previousTitle = pageTitles.current.get(pathname);
    if (
      managed?.backgroundPath === pathname &&
      previousTitle &&
      document.title === managed.title
    ) {
      document.title = previousTitle;
    }
    // Never restore in cleanup: a different destination owns its own metadata.
    managedTitle.current = null;
    const currentTitleIsPreference = Object.values(sections).some(
      ({ label }) => document.title === `${label} | Anuntech Console`,
    );
    if (!currentTitleIsPreference)
      pageTitles.current.set(pathname, document.title);
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

export function PreferencesDialog({
  section,
  title,
  description,
  admin,
  intercepted = false,
  children,
}: {
  section: PreferenceSection;
  title: string;
  description: string;
  admin: boolean;
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
  const sectionPath = sections[section].href;
  const visible =
    pathname === sectionPath && (intercepted || !navigation.intercepted);
  const close = () => {
    if (!intercepted || navigation.directEntry) router.replace("/painel");
    else router.back();
  };
  const navigationItems = (Object.keys(sections) as PreferenceSection[]).filter(
    (item) => admin || item === "account",
  );
  const sidebar = (
    <aside className={styles.sidebar}>
      <p className={styles.sidebarTitle}>Preferências</p>
      <nav className={styles.navigation} aria-label="Seções de preferências">
        {navigationItems.map((item) => {
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
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <p className={styles.sidebarNote}>Anuntech Console</p>
    </aside>
  );
  const background = !intercepted ? (
    <div className={styles.background} aria-hidden="true" />
  ) : null;
  if (!visible) return background;

  // The server view keeps forms and authorization results in the rendered HTML.
  // Hydration replaces this single view with Base UI's focus-managed dialog.
  if (!hydrated) {
    return (
      <>
        {background}
        <div className={styles.fallbackBackdrop} aria-hidden="true" />
        <section className={styles.popup} aria-labelledby="preferences-title">
          {sidebar}
          <div className={styles.content}>
            <header className={styles.header}>
              <h1 id="preferences-title" className={styles.title}>
                {title}
              </h1>
              <p className={styles.description}>{description}</p>
            </header>
            <div className={styles.body}>{children}</div>
          </div>
          <Link
            href="/painel"
            className={`icon-button ${styles.close}`}
            aria-label="Fechar preferências"
          >
            <X size={18} aria-hidden="true" />
          </Link>
        </section>
      </>
    );
  }
  return (
    <>
      {background}
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
            {sidebar}
            <div className={styles.content}>
              <header className={styles.header}>
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
            <Dialog.Close
              className={`icon-button ${styles.close}`}
              aria-label="Fechar preferências"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
