import "server-only";
import { isJmapId } from "./mail-rules";

/*
 * The Console's JMAP client (RFC 8620/8621) for the Stalwart server, with
 * the service account (STALWART_USER/STALWART_PASSWORD, Basic auth). It never
 * runs in the browser and never takes an accountId from it: callers resolve a
 * mailbox's address here, after checking the person may open it
 * (lib/mail/mailbox.ts).
 *
 * - The session (apiUrl, downloadUrl, uploadUrl) is cached for 5 minutes,
 *   and address → accountId for 10 (a miss for 1).
 * - At most 4 requests at once per instance (the server's
 *   maxConcurrentRequests); the rest wait in line.
 * - 429 and 503 are retried with a short wait; a send is retried only on 429,
 *   when the server did nothing.
 * - Every request has a timeout. Errors carry the method and the HTTP status,
 *   never message content.
 */

const CORE = "urn:ietf:params:jmap:core";
export const USING = {
  mail: [CORE, "urn:ietf:params:jmap:mail"],
  submission: [CORE, "urn:ietf:params:jmap:mail", "urn:ietf:params:jmap:submission"],
  principals: [CORE, "urn:ietf:params:jmap:principals"],
};

const SESSION_TTL = 5 * 60_000;
const ACCOUNT_TTL = 10 * 60_000;
const MISS_TTL = 60_000;
const TIMEOUT = 20_000;
const LANES = 4;

/** The server is missing, down or refused: the page says so, the action answers in Portuguese. */
export class MailUnavailable extends Error {
  constructor(
    readonly step: string,
    readonly status?: number,
    /** The request may have reached the server (a timeout): a send must not be repeated blindly. */
    readonly uncertain = false,
  ) {
    super(`JMAP ${step} failed${status ? ` (${status})` : ""}`);
    this.name = "MailUnavailable";
  }
}

/** A JMAP method answered with an error (notFound, invalidArguments…): the type only. */
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

function base() {
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

/**
 * One HTTP request to the server, with the lanes, the timeout and the
 * retries. `idempotent: false` (a send) retries only on 429.
 */
async function call(step: string, url: string, init: RequestInit, { idempotent = true } = {}) {
  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await lane(() =>
        fetch(url, {
          ...init,
          headers: { Authorization: authorization(), ...init.headers },
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

type Session = { apiUrl: string; downloadUrl: string; uploadUrl: string; adminAccount: string; expires: number };
let session: Session | null = null;

/**
 * The server's own URLs, kept on STALWART_URL's origin: the credentials only
 * ever go to the server the environment names, whatever the session says.
 */
function onServer(announced: string, server: URL) {
  // Templates keep their {placeholders}; parse with them escaped and put them back.
  const parsed = new URL(announced.replace(/[{}]/g, (c) => (c === "{" ? "%7B" : "%7D")), server);
  return `${server.origin}${parsed.pathname}${parsed.search}`.replace(/%7B/gi, "{").replace(/%7D/gi, "}");
}

async function getSession() {
  if (session && session.expires > Date.now()) return session;
  const server = base();
  const response = await call("session", new URL("/jmap/session", server).toString(), { method: "GET" });
  const data = (await response.json().catch(() => null)) as {
    apiUrl?: string;
    downloadUrl?: string;
    uploadUrl?: string;
    primaryAccounts?: Record<string, string>;
  } | null;
  const adminAccount = data?.primaryAccounts?.["urn:ietf:params:jmap:principals"] ?? data?.primaryAccounts?.["urn:ietf:params:jmap:mail"];
  if (!data?.apiUrl || !data.downloadUrl || !data.uploadUrl || !adminAccount) throw new MailUnavailable("session");
  session = {
    apiUrl: onServer(data.apiUrl, server),
    downloadUrl: onServer(data.downloadUrl, server),
    uploadUrl: onServer(data.uploadUrl, server),
    adminAccount,
    expires: Date.now() + SESSION_TTL,
  };
  return session;
}

export type Invocation = [name: string, args: Record<string, unknown>, callId: string];

/** One JMAP request: the method calls in order, the answers by call id. */
export async function jmap(using: string[], calls: Invocation[], { idempotent = true } = {}) {
  const { apiUrl } = await getSession();
  const step = calls.map((c) => c[0]).join("+");
  const response = await call(
    step,
    apiUrl,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ using, methodCalls: calls }) },
    { idempotent },
  );
  const data = (await response.json().catch(() => null)) as { methodResponses?: Invocation[] } | null;
  if (!Array.isArray(data?.methodResponses)) throw new MailUnavailable(step);
  const answers = new Map<string, Invocation>();
  for (const answer of data.methodResponses) answers.set(`${answer[2]}:${answer[0]}`, answer);
  /** The answer of `callId`, or a MailMethodError when that method failed. */
  return function result<T = Record<string, unknown>>(callId: string, name: string): T {
    const answer = answers.get(`${callId}:${name}`);
    if (answer) return answer[1] as T;
    const failed = answers.get(`${callId}:error`);
    throw new MailMethodError(name, String((failed?.[1] as { type?: unknown })?.type ?? "missing"));
  };
}

const accounts = new Map<string, { id: string | null; expires: number }>();

/**
 * The mail accountId of an address, through the principals the service
 * account sees. Only an exact match of the principal's address counts.
 */
export async function accountIdFor(address: string) {
  const email = address.trim().toLowerCase();
  const cached = accounts.get(email);
  if (cached && cached.expires > Date.now()) return cached.id;
  const { adminAccount } = await getSession();
  const result = await jmap(USING.principals, [
    ["Principal/query", { accountId: adminAccount, filter: { email } }, "0"],
    [
      "Principal/get",
      { accountId: adminAccount, "#ids": { resultOf: "0", name: "Principal/query", path: "/ids" }, properties: ["id", "email", "type"] },
      "1",
    ],
  ]);
  const { list } = result<{ list: { id: string; email?: string | null }[] }>("1", "Principal/get");
  const found = list.find((p) => p.email?.trim().toLowerCase() === email && isJmapId(p.id));
  const id = found?.id ?? null;
  accounts.set(email, { id, expires: Date.now() + (id ? ACCOUNT_TTL : MISS_TTL) });
  return id;
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(values[key] ?? ""));

/** A blob of the account, as a stream from the server. */
export async function downloadBlob(accountId: string, blobId: string, name: string) {
  const { downloadUrl } = await getSession();
  const url = fill(downloadUrl, { accountId, blobId, name, type: "application/octet-stream" });
  return call("download", url, { method: "GET" });
}

/** A blob's bytes, for inline images; null past `max` bytes. */
export async function blobBytes(accountId: string, blobId: string, max: number) {
  const response = await downloadBlob(accountId, blobId, "inline");
  const declared = Number(response.headers.get("content-length"));
  if (declared > max) {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.length > max ? null : bytes;
}

/** Uploads one attachment to the account; the server answers with its blobId. */
export async function uploadBlob(accountId: string, body: Uint8Array, type: string) {
  const { uploadUrl } = await getSession();
  const response = await call("upload", fill(uploadUrl, { accountId }), {
    method: "POST",
    headers: { "Content-Type": type || "application/octet-stream" },
    body: body as BodyInit,
  });
  const data = (await response.json().catch(() => null)) as { blobId?: string; size?: number; type?: string } | null;
  if (!isJmapId(data?.blobId)) throw new MailUnavailable("upload");
  return { blobId: data.blobId, size: Number(data.size) || body.length, type: data.type || type || "application/octet-stream" };
}
