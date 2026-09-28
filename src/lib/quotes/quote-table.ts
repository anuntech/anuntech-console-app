import { pageQuery, type PageQuery, type SearchParams } from "../list-query";
import { quoteFilters, quoteQuery, type QuoteQuery, type QuoteStatusFilter } from "./quote-model";

/**
 * What the quotes list reads from its URL: the filters links from elsewhere
 * already use (`status`, `company`, `q`; see `quoteQuery`) plus `page` and
 * `size`. `quoteListHref` writes all of them back.
 */
export type QuoteTableQuery = QuoteQuery & PageQuery;
export const quoteTableQuery = (params: SearchParams): QuoteTableQuery => ({
  ...quoteQuery(params),
  ...pageQuery(params),
});

/** Clients never see drafts or cancelled proposals, so those two filters are staff-only. */
const STAFF_ONLY_FILTERS: readonly QuoteStatusFilter[] = ["draft", "cancelled"];
export const quoteFiltersFor = (admin: boolean): QuoteStatusFilter[] =>
  admin ? quoteFilters : quoteFilters.filter((filter) => !STAFF_ONLY_FILTERS.includes(filter));

export const QUOTE_NOUN: [string, string] = ["orçamento", "orçamentos"];
