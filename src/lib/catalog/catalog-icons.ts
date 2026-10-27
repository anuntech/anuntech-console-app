/*
 * Catalog item icons. Client-safe: no database, no blob.
 *
 * `catalog_items.icon` holds one of two things:
 * - a bundled gallery path, "/brand/catalog-icons/<slug>.webp" (public, generic art
 *   and Anuntech's own product marks; origin in docs/catalog-icon-sources.json);
 * - a private blob pathname, "catalog-icons/<itemId>/<uuid>.webp" (an upload or an
 *   AI-generated icon), served by /api/catalogo/<itemId>/icone with access checks.
 * Anything else is ignored. Never accept arbitrary image URLs.
 */

export type GalleryIcon = { slug: string; label: string; path: string; keywords: string[] };

const gallery = (slug: string, label: string, keywords: string[]): GalleryIcon => ({
  slug,
  label,
  path: `/brand/catalog-icons/${slug}.webp`,
  keywords,
});

/** In the order the suggestion tries them: the first keyword found in the name wins. */
export const CATALOG_ICON_GALLERY: GalleryIcon[] = [
  gallery("synova", "Synova", ["synova"]),
  gallery("workspace", "Workspace", ["workspace"]),
  gallery("email", "E-mail", ["e-mail", "email", "mail"]),
  gallery("servidor", "Servidor", ["máquina virtual", "maquina virtual", "servidor", "vps", " vm "]),
  gallery("infra", "Nuvem e infraestrutura", ["infra", "nuvem", "cloud", "hospedagem"]),
  gallery("security", "Segurança", ["segurança", "seguranca", "security", "pentest", "invasão", "invasao"]),
  gallery("dominio", "Domínio", ["domínio", "dominio", "dns"]),
  gallery("horas", "Banco de horas", ["banco de horas", "horas"]),
  gallery("suporte", "Suporte", ["suporte", "sustentação", "sustentacao", "manutenção", "manutencao"]),
  gallery("consultoria", "Consultoria", ["consultoria", "mentoria"]),
  gallery("equipe", "Equipe alocada", ["squad", "equipe", "alocad"]),
  gallery("site", "Site", ["site", "landing", "página", "pagina"]),
  gallery("app", "Aplicativo", ["aplicativo", " app ", "mobile"]),
  gallery("desenvolvimento", "Desenvolvimento", ["desenvolvimento", "software", "sistema", "plataforma", "portal", "saas", "licença", "licenca"]),
  gallery("servico", "Serviço técnico", ["serviço", "servico", "escopo", "técnico", "tecnico"]),
];

// The file name is always a randomUUID().
const STORED = /^catalog-icons\/([A-Za-z0-9-]{1,64})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;

export function isGalleryIcon(value: unknown): value is string {
  return typeof value === "string" && CATALOG_ICON_GALLERY.some((icon) => icon.path === value);
}

/** A blob pathname that belongs to this item (when `itemId` is given). */
export function isStoredCatalogIcon(value: unknown, itemId?: string): value is string {
  if (typeof value !== "string") return false;
  const match = STORED.exec(value);
  return !!match && (itemId === undefined || match[1] === itemId);
}

/** Where the browser loads the icon from, or null when the item has none. */
export function catalogIconSrc(itemId: string | null | undefined, icon: string | null | undefined): string | null {
  if (!itemId || !icon) return null;
  if (isGalleryIcon(icon)) return icon;
  const match = STORED.exec(icon);
  if (!match || match[1] !== itemId) return null;
  // The file name is a fresh uuid per icon, so the URL changes with it and can be cached for good.
  return `/api/catalogo/${itemId}/icone?v=${match[2]}`;
}

/** A gallery icon that fits the name, for items that have none yet. */
export function suggestGalleryIcon(name: string): GalleryIcon | null {
  const text = ` ${name.toLowerCase()} `;
  return CATALOG_ICON_GALLERY.find((icon) => icon.keywords.some((word) => text.includes(word))) ?? null;
}
