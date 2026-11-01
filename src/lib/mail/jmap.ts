import "server-only";

/*
 * The Console's JMAP client for the Stalwart server's management API
 * (capability `urn:stalwart:jmap`, the `x:` methods), with the service
 * account (STALWART_USER/STALWART_PASSWORD, Basic auth). Its role only allows
 * accounts, mailing lists, reading domains and DKIM keys: it has no
 * `impersonate`, so it cannot open anyone's mailbox, and the Console never
 * asks it to (docs/memory.md, 31/10/2026).
 *
 * - The session's apiUrl is cached for 5 minutes and pinned to STALWART_URL's
 *   origin: the credentials only go to the server the environment names.
 * - At most 4 requests at once per instance; the rest wait in line.
 * - 429 and 503 are retried with a short wait; a create (not idempotent) is
 *   retried only on 429, when the server did nothing.
 * - Every request has a timeout. Errors carry the method and the HTTP status,
 *   never the request: it may hold a password.
 */

export const ADMIN_USING = ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"];

const SESSION_TTL = 5 * 60_000;
const TIMEOUT = 15_000;
const LANES = 4;

/** The server is missing, down or refused the request: the page says so, the action answers in Portuguese. */
export class MailUnavailable extends Error {
  constructor(
    readonly step: string,
    readonly status?: number,
    /** The request may have reached the server (a timeout): a create must not be repeated blindly. */
    readonly uncertain = false,
  ) {
    super(`JMAP ${step} failed${status ? ` (${status})` : ""}`);
    this.name = "MailUnavailable";
  }
}

/** A JMAP method answered with an error (forbidden, unknownMethod…): the type only. */
export class MailMethodError extends Error {
  constructor(
    readonly method: string,
    readonly type: string,
  ) {
    super(`JMAP ${method}: ${type}`);
    this.name = "MailMethodError";
  }
}

export function mailConfigured() {
  return !!(process.env.STALWART_URL && process.env.STALWART_USER && process.env.STALWART_PASSWORD);
}

function server() {
  const url = process.env.STALWART_URL;
  if (!url || !mailConfigured()) throw new MailUnavailable("config");
  return new URL(url);
}

const authorization = () =>
  `Basic ${Buffer.from(`${process.env.STALWART_USER}:${process.env.STALWART_PASSWORD}`).toString("base64")}`;

// Four lanes per instance, first come first served.
let running = 0;
const waiting: (() => void)[] = [];
async function lane<T>(work: () => Promise<T>) {
  if (running >= LANES) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One HTTP request to the server, with the lanes, the timeout and the retries. */
async function call(step: string, url: string, init: RequestInit, { idempotent = true } = {}) {
  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await lane(() =>
        fetch(url, {
          ...init,
          headers: { Authorization: authorization(), Accept: "application/json", ...init.headers },
          signal: AbortSignal.timeout(TIMEOUT),
          cache: "no-store",
          redirect: "error",
        }),
      );
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      console.error(`[email] ${step} failed`, { reason: timedOut ? "timeout" : "network" });
      throw new MailUnavailable(step, undefined, timedOut);
    }
    const retry = response.status === 429 || (idempotent && response.status === 503);
    if (retry && attempt < 3) {
      await response.body?.cancel().catch(() => {});
      const after = Number(response.headers.get("retry-after"));
      await pause(Number.isFinite(after) && after > 0 ? Math.min(after, 5) * 1000 : 400 * attempt);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      console.error(`[email] ${step} failed`, { status: response.status });
      throw new MailUnavailable(step, response.status);
    }
    return response;
  }
}

let session: { apiUrl: string; expires: number } | null = null;

/** The announced apiUrl, kept on STALWART_URL's origin whatever the session says. */
function onServer(announced: string, origin: URL) {
  const parsed = new URL(announced, origin);
  return `${origin.origin}${parsed.pathname}${parsed.search}`;
}

async function apiUrl() {
  if (session && session.expires > Date.now()) return session.apiUrl;
  const origin = server();
  const response = await call("session", new URL("/jmap/session", origin).toString(), { method: "GET" });
  const data = (await response.json().catch(() => null)) as { apiUrl?: unknown } | null;
  if (typeof data?.apiUrl !== "string") throw new MailUnavailable("session");
  session = { apiUrl: onServer(data.apiUrl, origin), expires: Date.now() + SESSION_TTL };
  return session.apiUrl;
}

export type Invocation = [name: string, args: Record<string, unknown>, callId: string];

/**
 * One JMAP request: the method calls in order, the answers by call id.
 * `idempotent: false` for a create, which is retried only on 429.
 */
export async function jmap(calls: Invocation[], { idempotent = true } = {}) {
  const url = await apiUrl();
  const step = calls.map((c) => c[0]).join("+");
  const response = await call(
    step,
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ using: ADMIN_USING, methodCalls: calls }) },
    { idempotent },
  );
  const data = (await response.json().catch(() => null)) as { methodResponses?: Invocation[] } | null;
  if (!Array.isArray(data?.methodResponses)) throw new MailUnavailable(step);
  const answers = new Map<string, Invocation>();
  for (const answer of data.methodResponses) if (Array.isArray(answer)) answers.set(`${answer[2]}:${answer[0]}`, answer);
  /** The answer of `callId`, or a MailMethodError when that method failed. */
  return function result<T = Record<string, unknown>>(callId: string, name: string): T {
    const answer = answers.get(`${callId}:${name}`);
    if (answer) return answer[1] as T;
    const failed = answers.get(`${callId}:error`);
    const type = String((failed?.[1] as { type?: unknown } | undefined)?.type ?? "missing");
    console.error(`[email] ${name} refused`, { type });
    throw new MailMethodError(name, type);
  };
}

/** JMAP ids (RFC 8620 §1.2): 1 to 255 URL-safe characters. */
export const isJmapId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,255}$/.test(value);
