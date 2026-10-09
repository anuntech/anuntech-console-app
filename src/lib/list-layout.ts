/**
 * How a list is drawn: rows in a table or cards in a grid. A personal
 * preference, one per area, kept in a cookie so the server renders the
 * chosen one at once. Without a choice the list opens as a grid.
 */
export const listLayouts = ["list", "grid"] as const;
export type ListLayout = (typeof listLayouts)[number];

export const LIST_LAYOUT_COOKIES = {
  bookmarks: "console-bookmarks-view",
  projects: "console-projects-view",
  contracts: "console-contracts-view",
  products: "console-products-view",
  companies: "console-companies-view",
  journeys: "console-journeys-view",
} as const;
export type ListLayoutArea = keyof typeof LIST_LAYOUT_COOKIES;

export function parseListLayout(value?: string): ListLayout {
  return listLayouts.includes(value as ListLayout) ? (value as ListLayout) : "grid";
}
