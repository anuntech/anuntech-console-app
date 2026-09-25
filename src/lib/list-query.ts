/**
 * Paging for every list in the Console. Lists read `page` and `size` from the
 * URL, so a filtered page can be shared and the back button works; the
 * server fetches only the rows of that page and the total for the footer.
 */

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type SearchParams = Record<string, string | string[] | undefined>;
export type PageQuery = { page: number; pageSize: number };

/** A single string parameter, "" when missing or repeated. */
export const scalarParam = (params: SearchParams, key: string) =>
  typeof params[key] === "string" ? (params[key] as string) : "";

/** `page` (1-based) and `size` from the URL, falling back to the defaults. */
export function pageQuery(params: SearchParams): PageQuery {
  const page = Number(scalarParam(params, "page"));
  const size = Number(scalarParam(params, "size"));
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** Writes `page` and `size` into a URL's params, leaving defaults out. */
export function setPageParams(params: URLSearchParams, { page, pageSize }: PageQuery) {
  if (page > 1) params.set("page", String(page));
  if (pageSize !== DEFAULT_PAGE_SIZE) params.set("size", String(pageSize));
  return params;
}

export const pageCountOf = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));

/** The page actually shown: a page past the end (after filtering) falls back to the last one. */
export const clampPage = (query: PageQuery, total: number): PageQuery => ({
  ...query,
  page: Math.min(query.page, pageCountOf(total, query.pageSize)),
});

export const offsetOf = ({ page, pageSize }: PageQuery) => (page - 1) * pageSize;

/** Builds `/path?…` from params, skipping empty values. */
export function listHref(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
