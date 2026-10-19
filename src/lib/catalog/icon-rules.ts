/*
 * When "Gerar com IA" tries the same image model again. No DOM and no server
 * code, so tests import it.
 */

/** Busy or unreachable: worth one more try. */
export const retryableIcon = (status: number) => status === 0 || status === 429 || status >= 500;

/** The whole generation, every model and retry included: the route stops it here. */
export const ICON_DEADLINE_MS = 75_000;

/**
 * One more try with the same model after a busy answer: after a quick
 * failure; after a slow one (its 50 s deadline) only for the last model, and
 * only when the time left could fit another such attempt. Otherwise the
 * time goes to the fallback, or the person hears at once.
 */
export const retryIcon = (status: number, elapsedMs: number, lastModel: boolean, leftMs: number) =>
  retryableIcon(status) && (elapsedMs < 20_000 || (lastModel && leftMs > elapsedMs));
