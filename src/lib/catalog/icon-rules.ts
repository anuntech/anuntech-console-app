/*
 * When "Gerar com IA" tries the same image model again. No DOM and no server
 * code, so tests import it.
 */

/** Busy or unreachable: worth one more try. */
export const retryableIcon = (status: number) => status === 0 || status === 429 || status >= 500;

/**
 * One more try with the same model after a busy answer: always when it is
 * the last model, else only after a quick failure, so a slow one (its 50 s
 * deadline) leaves the route's time to the fallback.
 */
export const retryIcon = (status: number, elapsedMs: number, lastModel: boolean) => retryableIcon(status) && (lastModel || elapsedMs < 20_000);
