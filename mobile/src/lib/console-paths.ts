/**
 * Where a Console web path goes in the app. One map for every place that
 * meets a Console link: Ajuda and Como trabalhamos (help-routes.ts), the
 * first steps, the assistant's buttons and the links that open the app from
 * outside (+native-intent.ts, e-mails).
 *
 * The query the screens read goes along (`?status=`, `?company=`), and the
 * web's `?tipo=` of a new ticket becomes the screen's `kind`. Only real ids
 * (uuid) open a detail: "/projetos/novo" is a web page, not a project.
 *
 * Pure (no React Native): the root tests import it.
 */

/** What the signed-in person can open in the app: Financeiro for Administradores, the company's pages for the Administrador of one company. */
export type AppReach = { finance: boolean; managed: boolean };

export type ConsoleTarget =
  /** A help article (/ajuda/<slug>). */
  | { kind: "article"; slug: string }
  /** A screen of the app: a path with its query, ready for the router. */
  | { kind: "app"; href: string }
  /** Nothing in the app: the Console page, opened on the web. */
  | { kind: "web"; path: string };

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const detail = (area: string) => new RegExp(`^/${area}(/${UUID})?$`);

/** The query keys each screen reads; the rest of a web link's query stays behind. */
const KEPT: Record<string, string[]> = {
  chamados: ["status", "company"],
  financeiro: ["status", "company"],
  contratos: ["status", "company"],
  orcamentos: ["status", "company"],
  projetos: ["status", "company"],
  produtos: ["status", "company"],
};

function withQuery(path: string, params: [string, string][]) {
  const query = params
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return query ? `${path}?${query}` : path;
}

/**
 * The Console path inside a link: the path itself ("/chamados?status=x"), or
 * the path, query and fragment of an http(s) address. Null for anything else
 * (another scheme, an address that does not parse).
 */
export function consolePath(link: string): string | null {
  if (link.startsWith("/") && !link.startsWith("//")) return link;
  if (!/^https?:\/\//i.test(link)) return null;
  try {
    const url = new URL(link);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Where a Console path (with its query) goes in the app, for this person. */
export function consoleTarget(href: string, reach: AppReach): ConsoleTarget {
  const web: ConsoleTarget = { kind: "web", path: href };
  const [beforeHash] = href.split("#");
  const queryAt = beforeHash.indexOf("?");
  const rawPath = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const path = rawPath.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(queryAt === -1 ? "" : beforeHash.slice(queryAt + 1));
  const app = (to: string, params: [string, string][] = []): ConsoleTarget => ({ kind: "app", href: withQuery(to, params) });
  const keep = (area: string) => (KEPT[area] ?? []).flatMap((key): [string, string][] => (query.has(key) ? [[key, query.get(key)!]] : []));

  const article = path.match(/^\/ajuda\/([\w-]+)$/);
  if (article) return { kind: "article", slug: article[1] };
  if (path === "/ajuda" || path === "/como-trabalhamos") return app(path);
  if (path === "/painel" || path === "/") return app("/");

  if (path === "/chamados/novo") {
    const kind = query.get("tipo") ?? query.get("kind");
    const params: [string, string][] = [];
    if (kind) params.push(["kind", kind]);
    for (const key of ["companyId", "engagementId"]) if (query.get(key)) params.push([key, query.get(key)!]);
    return app(path, params);
  }
  for (const area of ["chamados", "contratos", "orcamentos", "projetos", "produtos"])
    if (detail(area).test(path)) return app(path, keep(area));
  if (detail("financeiro").test(path)) return reach.finance ? app(path, keep("financeiro")) : web;

  const product = path.match(new RegExp(`^/apps/(${UUID})$`));
  if (product) return app(`/produtos/app/${product[1]}`);
  if (path === "/bookmarks") {
    // "Copiar link" (?abrir=<id>): the item itself, which answers "not found" to who does not see it.
    const opened = query.get("abrir");
    return opened && new RegExp(`^${UUID}$`).test(opened) ? app(`/bookmarks/${opened.toLowerCase()}/ver`) : app(path);
  }
  const board = path.match(new RegExp(`^/bookmarks/(${UUID})/lousa$`));
  if (board) return app(`/bookmarks/${board[1]}/lousa`);

  if (path === "/conta" || path === "/configuracoes") return app("/conta");
  if (path === "/configuracoes/aparencia") return app("/conta/aparencia");
  if (path === "/configuracoes/seguranca") return app("/conta/seguranca");
  const company = path.match(/^\/configuracoes\/(empresa|membros|notificacoes)$/);
  if (company && reach.managed) return app(`/conta/${company[1]}`);
  return web;
}
