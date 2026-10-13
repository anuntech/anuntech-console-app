/**
 * Client apps that only run inside the Console (docs/prd.md, "Apps dentro do
 * Console"). Each one trusts a short-lived pass the Console signs (pass.ts)
 * and blocks being opened straight from the address bar, so a product whose
 * URL points at one of them opens at /apps/<engagement>, never in a new tab.
 *
 * Pure: no database, no Next. Tests and server code pass the environment in.
 */

/** Who the person is for the app: the Anuntech team, or their role in the company. */
export type PassRole = "staff" | "manager" | "member";

export type ProtectedApp = {
  /** The pass's `aud`; each app checks it against its own id. */
  id: string;
  name: string;
  /** Hosts (with the port, when not the default) a product URL may use to point at the app. */
  hosts: string[];
  /** Where the Console opens the app, whatever host the product URL used. */
  origin: string;
  /** The protected part of the app: "/" when the whole app is protected. */
  entry: string;
  /** The lowest company role that opens it; the team always can. */
  minRole: "manager" | "member";
  /**
   * Apps that keep their data under their own id for each client: Console
   * company id → that id, sent as `tenant`. A company missing here cannot
   * open the app, since the app refuses a pass without it.
   */
  tenants?: Record<string, string>;
};

export const PROTECTED_APPS: readonly ProtectedApp[] = [
  {
    id: "espaco-absolut-cms",
    name: "CMS Espaço Absolut",
    hosts: ["www.espacoabsolut.com", "espacoabsolut.com"],
    origin: "https://www.espacoabsolut.com",
    entry: "/admin",
    minRole: "manager",
  },
  {
    id: "mulheresfm-cms",
    name: "CMS MulheresFM",
    hosts: ["www.mulheresfm.com.br", "mulheresfm.com.br", "mulheresfmanuntech.vercel.app"],
    origin: "https://www.mulheresfm.com.br",
    entry: "/admin",
    minRole: "manager",
  },
  {
    id: "brastemp-roteiro-digital",
    name: "Roteiro Digital",
    hosts: ["brastemp-roteiro-digital.vercel.app"],
    origin: "https://brastemp-roteiro-digital.vercel.app",
    entry: "/",
    minRole: "member",
  },
  {
    id: "brastemp-base-pendente",
    name: "Base Pendente",
    hosts: ["brastemp-base-pendente.vercel.app"],
    origin: "https://brastemp-base-pendente.vercel.app",
    entry: "/",
    minRole: "member",
    // Alvitek's data in the app's own database already lives under this workspace id.
    tenants: { "b0101b2f-4586-4533-964b-b3d8157b9378": "dfbi2Hn3rypBVlFSpKdKAfMd5BjXYQoY" },
  },
];

type Env = Record<string, string | undefined>;

/** An http(s) origin with nothing after it, or null. */
function originOf(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * The registry as this deployment sees it. CONSOLE_APP_ORIGINS
 * (`{"<aud>": "http://localhost:4001"}`) points an app at a local copy for
 * testing: it replaces the origin and accepts that host in product URLs. It is
 * ignored in Vercel production, where a stray value would send passes elsewhere.
 */
export function protectedApps(env: Env = process.env): ProtectedApp[] {
  const apps = PROTECTED_APPS.map((app) => ({ ...app, hosts: [...app.hosts] }));
  const raw = env.CONSOLE_APP_ORIGINS?.trim();
  if (!raw || env.VERCEL_ENV === "production") return apps;
  let overrides: unknown;
  try {
    overrides = JSON.parse(raw);
  } catch {
    return apps;
  }
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return apps;
  for (const [id, value] of Object.entries(overrides)) {
    const app = apps.find((candidate) => candidate.id === id);
    const url = originOf(value);
    if (!app || !url) continue;
    app.origin = url.origin;
    if (!app.hosts.includes(url.host)) app.hosts.push(url.host);
  }
  return apps;
}

/** "/admin" covers "/admin" and "/admin/…", not "/administrador"; "/" covers everything. */
function underEntry(pathname: string, entry: string) {
  if (entry === "/") return true;
  const prefix = entry.replace(/\/+$/, "");
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * The protected app a product URL points at: one of the app's hosts and a path
 * inside its protected entry. The public site on the same host is not the app
 * (https://www.espacoabsolut.com/ stays a plain link).
 */
export function appForUrl(url: string | null | undefined, apps: readonly ProtectedApp[] = protectedApps()) {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  const host = parsed.host.toLowerCase();
  return apps.find((app) => app.hosts.includes(host) && underEntry(parsed.pathname, app.entry)) ?? null;
}

/** The team opens every app; an Administrator too; a Member only the apps meant for members. */
export function canOpenApp(role: PassRole, app: Pick<ProtectedApp, "minRole">) {
  return role === "staff" || role === "manager" || app.minRole === "member";
}

/**
 * The `tenant` to send for a company: undefined when the app does not use one,
 * null when it does and this company has none yet (the app would refuse it).
 */
export function appTenant(app: Pick<ProtectedApp, "tenants">, companyId: string) {
  if (!app.tenants) return undefined;
  return Object.hasOwn(app.tenants, companyId) ? app.tenants[companyId] : null;
}

/** Where the iframe goes: the app's entry with the pass, which the app trades for its own cookie. */
export function appFrameSrc(app: Pick<ProtectedApp, "origin" | "entry">, pass: string) {
  const url = new URL(app.entry, app.origin);
  url.searchParams.set("console_pass", pass);
  return url.toString();
}

export type AppBlock = "not_product" | "inactive" | "not_protected" | "role" | "no_tenant";

/**
 * Whether a product can be opened as an app by someone with `role` in its
 * company, and with which tenant. Access to the company itself is checked
 * before this (canAccess), so a record outside it never gets this far.
 */
export function decideAppOpening(
  engagement: { kind: string; status: string; url: string | null; companyId: string },
  role: PassRole,
  apps: readonly ProtectedApp[] = protectedApps(),
): { app: ProtectedApp; tenant: string | undefined } | { blocked: AppBlock; app: ProtectedApp | null } {
  if (engagement.kind !== "product") return { blocked: "not_product", app: null };
  const app = appForUrl(engagement.url, apps);
  if (!app) return { blocked: "not_protected", app: null };
  if (engagement.status !== "active") return { blocked: "inactive", app };
  if (!canOpenApp(role, app)) return { blocked: "role", app };
  const tenant = appTenant(app, engagement.companyId);
  if (tenant === null) return { blocked: "no_tenant", app };
  return { app, tenant };
}
