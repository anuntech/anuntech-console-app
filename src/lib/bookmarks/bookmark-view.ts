/** How the bookmarks list is drawn; a personal preference kept in a cookie. */
export const bookmarkViews = ["list", "grid"] as const;
export type BookmarkLayout = (typeof bookmarkViews)[number];
export const BOOKMARK_VIEW_COOKIE = "console-bookmarks-view";

export function parseBookmarkView(value?: string): BookmarkLayout {
  return bookmarkViews.includes(value as BookmarkLayout) ? (value as BookmarkLayout) : "list";
}
