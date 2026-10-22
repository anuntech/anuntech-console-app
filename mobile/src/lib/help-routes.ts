import { Linking } from "react-native";
import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { CONSOLE_URL } from "./config";
import { useMe } from "./me";

/** The team's WhatsApp, as on the Console's /suporte page: (11) 5107-3435, on business days. */
export const TEAM_WHATSAPP = { label: "(11) 5107-3435", url: "https://wa.me/551151073435" };

/** Opens the conversation with the team on WhatsApp (or its page, without the app). */
export function talkToTeam() {
  void Linking.openURL(TEAM_WHATSAPP.url).catch(() => WebBrowser.openBrowserAsync(TEAM_WHATSAPP.url));
}

/** What the person can open in the app: Financeiro for Administradores, the company's pages for the Administrador of one company. */
export type AppReach = { finance: boolean; managed: boolean };

export type HelpTarget =
  | { kind: "article"; slug: string }
  | { kind: "app"; route: Href }
  | { kind: "web"; url: string };

/**
 * Where a Console path from the help text, a guide or a first step goes in
 * the app: an article, the app's own screen, or the Console in the in-app
 * browser for what the app does not have (Produtos, Aparência).
 */
export function helpTarget(href: string, reach: AppReach): HelpTarget {
  const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const article = path.match(/^\/ajuda\/([\w-]+)$/);
  if (article) return { kind: "article", slug: article[1] };
  if (path === "/ajuda") return { kind: "app", route: "/ajuda" };
  if (path === "/como-trabalhamos") return { kind: "app", route: "/como-trabalhamos" };
  if (path === "/painel" || path === "/") return { kind: "app", route: "/" };
  if (path === "/chamados/novo") return { kind: "app", route: "/chamados/novo" };
  if (/^\/(chamados|projetos|contratos|orcamentos)(\/[\w-]+)?$/.test(path) || path === "/bookmarks") return { kind: "app", route: path as Href };
  if (/^\/financeiro(\/[\w-]+)?$/.test(path) && reach.finance) return { kind: "app", route: path as Href };
  if (path === "/conta") return { kind: "app", route: "/conta" };
  if (path === "/configuracoes/seguranca") return { kind: "app", route: "/conta/seguranca" };
  const company = path.match(/^\/configuracoes\/(empresa|membros|notificacoes)$/);
  if (company && reach.managed) return { kind: "app", route: `/conta/${company[1]}` as Href };
  return { kind: "web", url: `${CONSOLE_URL}${href}` };
}

/**
 * Follows a Console path. Inside Ajuda (over the tabs) an app screen closes
 * the help first and opens in its tab; an article stacks on the help.
 */
export function followHelpLink(href: string, reach: AppReach, from: "help" | "app") {
  const target = helpTarget(href, reach);
  if (target.kind === "article") router.push({ pathname: "/ajuda/[slug]", params: { slug: target.slug } });
  else if (target.kind === "web") void WebBrowser.openBrowserAsync(target.url);
  else if (target.route === "/ajuda" || target.route === "/como-trabalhamos") router.push(target.route);
  else if (from === "help") router.dismissTo(target.route);
  else router.push(target.route);
}

/** Leaves Ajuda for a screen of the tabs (the assistant, a new ticket). */
export function leaveHelpTo(route: Href) {
  router.dismissTo(route);
}

/** What the signed-in person reaches in the app, for help links (as the tabs and Conta decide). */
export function useAppReach(): AppReach {
  const me = useMe();
  return {
    finance: !!me.data && (me.data.staff || me.data.companies.some((c) => c.role === "manager")),
    managed: !!me.data?.managedCompanyId,
  };
}
