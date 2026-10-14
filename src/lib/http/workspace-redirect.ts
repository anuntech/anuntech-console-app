/**
 * workspace.anuntech.com, the Workspace the Console replaced, is attached to
 * this project. Every request on that host goes to the closest page of the
 * Console (docs/memory.md, 14/10/2026). The redirect is temporary (307) so the
 * domain can be pointed somewhere else later without browsers holding on to it.
 *
 * Pure: no Next, no environment. The proxy calls it; tests/workspace-redirect
 * covers the whole map.
 */

export const WORKSPACE_HOST = "workspace.anuntech.com";

/** Fixed, never read from the request: the Host header is whatever the client sent. */
export const CONSOLE_ORIGIN = "https://console.anuntech.com";

/** Workspace application ids → the Console app registry ids (lib/apps/registry.ts). */
const WORKSPACE_APPS = new Map([
  ["1e9b1689-4f40-452d-992d-914eadad3cd0", "brastemp-base-pendente"],
  ["app_mulheresfm", "mulheresfm-cms"],
]);

const SIGN_IN_PAGES = new Set(["login", "register", "forgot-password", "reset-password"]);

/** Hostname of a Host header, without the port, in lower case. */
export function isWorkspaceHost(host: string | null | undefined) {
  return host?.split(":", 1)[0].toLowerCase() === WORKSPACE_HOST;
}

/**
 * The Console path for a Workspace path. Only the path is read: the query
 * string is dropped on purpose, so an old `?token=` never travels on.
 */
export function workspaceDestination(pathname: string) {
  const [first, second, ...rest] = pathname.split("/").filter(Boolean);
  switch (first) {
    case "apps": {
      const app = second && WORKSPACE_APPS.get(second);
      return app ? `/abrir/${app}` : "/produtos";
    }
    case "support":
      return second === "new" && rest.length === 0 ? "/chamados/novo" : "/chamados";
    case "shortcuts":
      return "/bookmarks";
    case "accept-invite":
      return "/entrar";
    default:
      return first && SIGN_IN_PAGES.has(first) && !second ? "/entrar" : "/painel";
  }
}

/** Where a request goes when it came to the Workspace host; null for any other host. */
export function workspaceRedirect(host: string | null | undefined, pathname: string) {
  return isWorkspaceHost(host) ? `${CONSOLE_ORIGIN}${workspaceDestination(pathname)}` : null;
}
