import { consolePath, consoleTarget } from "@/lib/console-paths";

/**
 * Links that open the app from outside (the Console's e-mails, as universal
 * and app links) carry the web's paths. The ones the app names differently go
 * to its screen: /painel (and /painel#banco-de-horas-…) to Início, /apps/<id>
 * to the product's app, /configuracoes/* to Conta, ?tipo= of a new ticket to
 * its kind. Anything else (other schemes, the app's own paths) goes on as it
 * came. Runs before sign-in and without the person, so Financeiro keeps its
 * path; the tab itself decides who sees it.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const web = /^https?:\/\//i.test(path) ? consolePath(path) : null;
    if (!web) return path;
    const target = consoleTarget(web, { finance: true, managed: true });
    if (target.kind === "app") return target.href;
    if (target.kind === "article") return `/ajuda/${target.slug}`;
    return path;
  } catch {
    return path;
  }
}
