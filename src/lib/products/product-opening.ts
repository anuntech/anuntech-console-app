import { appForUrl, type ProtectedApp } from "../apps/registry";

/** Only web links open outside (the actions accept nothing else). */
export function webUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

export type ProductOpening = { opensAs: "app" | "link" | "service" | "none"; url: string | null };

/**
 * Where a product or service opens, as the Painel and Produtos decide it: a
 * service has its own page, a product whose URL is a protected app opens
 * inside the Console (in the app, the in-app browser with a pass), any other
 * product opens its own web link, and a product without one opens nothing yet.
 * Pure, for tests.
 */
export function productOpening(kind: string, url: string | null | undefined, apps: readonly ProtectedApp[]): ProductOpening {
  if (kind === "service") return { opensAs: "service", url: null };
  if (kind !== "product") return { opensAs: "none", url: null };
  if (appForUrl(url, apps)) return { opensAs: "app", url: null };
  const link = webUrl(url);
  return link ? { opensAs: "link", url: link } : { opensAs: "none", url: null };
}

/**
 * The e-mail product (a catalog item blocked as "Servidor de e-mail") opens
 * the company's mailboxes inside the Console, whatever its link says.
 */
export const mailPageOf = (kind: string, suspensionKind: string | null | undefined, companyId: string) =>
  kind === "product" && suspensionKind === "email" ? `/email?empresa=${encodeURIComponent(companyId)}` : null;
