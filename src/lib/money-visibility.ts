/*
 * The eye on the overview: money values start hidden (blurred, so nothing
 * moves when they show) and the viewer's choice is kept in a cookie, read on
 * the server so the page arrives already hidden or shown.
 */
export const MONEY_COOKIE = "console-values";

/** Hidden unless the viewer chose to show them. */
export const moneyHiddenFrom = (value: string | undefined) => value !== "shown";
