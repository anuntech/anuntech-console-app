import { GatewayError } from "@ai-sdk/gateway";

/*
 * What a failed Gateway call means for a retry or a fallback, and what its
 * log line may say: the status and the Gateway's own words, never the cause
 * (it carries the request, client data included). No server-only import, so
 * tests run it.
 */

/** Whether an error is a deadline or a cancel, as itself or wrapped by the Gateway provider (a 500 around the abort). */
export function stoppedBy(error: unknown): string | null {
  const own = error instanceof Error ? error.name : "";
  if (own === "TimeoutError" || own === "AbortError" || own === "GatewayTimeoutError") return own;
  const cause = (error as { cause?: unknown } | null)?.cause;
  return cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError") ? cause.name : null;
}

/** The status a failed call counts as (0 when the Gateway was not reached) and a short detail for the log. */
export function gatewayStatus(error: unknown): { status: number; detail: string } {
  if (GatewayError.isInstance(error)) {
    const stopped = stoppedBy(error);
    return { status: error.statusCode, detail: stopped ? `timeout (${stopped})` : error.message.slice(0, 200) };
  }
  // A missing or refused credential, as the SDK rewraps it: the status is gone, the name stays.
  if (error instanceof Error && error.name.startsWith("Gateway")) return { status: 401, detail: error.name };
  return { status: 0, detail: error instanceof Error ? error.name : "unknown" };
}
