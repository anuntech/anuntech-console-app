import { Linking } from "react-native";
import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { consoleTarget, type AppReach } from "./console-paths";
import { openConsole } from "./console-web";
import { useMe } from "./me";

/** The team's WhatsApp, as on the Console's /suporte page: (11) 5107-3435, on business days. */
export const TEAM_WHATSAPP = { label: "(11) 5107-3435", url: "https://wa.me/551151073435" };

/** Opens the conversation with the team on WhatsApp (or its page, without the app). */
export function talkToTeam() {
  void Linking.openURL(TEAM_WHATSAPP.url).catch(() => WebBrowser.openBrowserAsync(TEAM_WHATSAPP.url));
}

export type { AppReach };

export type HelpTarget =
  | { kind: "article"; slug: string }
  | { kind: "app"; route: Href }
  | { kind: "web"; path: string };

/**
 * Where a Console path from the help text, a guide, a first step or the
 * assistant goes in the app: an article, the app's own screen (with the
 * filter or the ticket kind of the link), or the Console in the in-app
 * browser, signed in, for what the app does not have. The map is
 * console-paths.ts, shared with the links that open the app from outside.
 */
export function helpTarget(href: string, reach: AppReach): HelpTarget {
  const target = consoleTarget(href, reach);
  if (target.kind === "app") return { kind: "app", route: target.href as Href };
  return target;
}

/**
 * Follows a Console path. Inside Ajuda (over the tabs) an app screen closes
 * the help first and opens in its tab; an article stacks on the help.
 */
export function followHelpLink(href: string, reach: AppReach, from: "help" | "app") {
  const target = helpTarget(href, reach);
  if (target.kind === "article") router.push({ pathname: "/ajuda/[slug]", params: { slug: target.slug } });
  else if (target.kind === "web") void openConsole(target.path);
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
