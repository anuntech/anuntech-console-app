/** A navigation entry as the phone bar sees it; the icon is opaque here so this stays testable. */
export type TabEntry<Icon = unknown> = { href: string; label: string; short?: string; icon: Icon };

/**
 * The routes the phone bar shows as tabs, four of them; everything else
 * lives under "Mais". Anuntech keeps companies at hand, a client keeps
 * its products, and anyone with fewer areas still gets four tabs.
 */
export function splitTabs<T extends TabEntry>(visible: T[], admin: boolean) {
  const preferred = admin
    ? ["/painel", "/empresas", "/chamados", "/financeiro"]
    : ["/painel", "/produtos", "/chamados", "/financeiro"];
  const primary = preferred
    .map((href) => visible.find((item) => item.href === href))
    .filter((item): item is T => !!item);
  for (const item of visible) if (primary.length < 4 && !primary.includes(item)) primary.push(item);
  return { primary, rest: visible.filter((item) => !primary.includes(item)) };
}
