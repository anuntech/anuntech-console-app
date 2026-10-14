/**
 * Where sign-in may send the person afterwards (`/entrar?volta=…`). A client
 * app opened straight from the address bar sends people to /abrir/<app>, and
 * that page sends them here when there is no session; after the code, Google
 * or the second step they land back on the app.
 *
 * The value comes from the URL, so it is an allowlist, not a sanitizer: one
 * Console path to an app (/abrir/<app id> or /apps/<product id>), nothing
 * else. No host, no "//", no backslash, no query, no fragment, no percent
 * escapes, no dots. Anything that does not match is dropped and the person
 * goes to /painel as before.
 *
 * Pure: the sign-in pages, the client forms and the security plugin all use it.
 */
const RETURN_PATH = /^\/(abrir|apps)\/[A-Za-z0-9-]{1,64}$/;

/** The path to go to after signing in, or null when the value is not one we send people to. */
export function safeReturnPath(value: unknown): string | null {
  return typeof value === "string" && RETURN_PATH.test(value) ? value : null;
}

/**
 * `path` carrying the return path along, when there is a valid one. The
 * allowed paths hold only letters, digits, "-" and "/", so they go as they are.
 */
export function withReturnPath(path: string, returnPath: unknown) {
  const safe = safeReturnPath(returnPath);
  if (!safe) return path;
  return `${path}${path.includes("?") ? "&" : "?"}volta=${safe}`;
}

/** Where the person goes once signed in. */
export function afterSignIn(returnPath: unknown) {
  return safeReturnPath(returnPath) ?? "/painel";
}

/**
 * The return path inside a Google sign-in's callbackURL, read back on the
 * callback when the second step interrupts it. Better Auth keeps the value as
 * the form sent it: a relative path, or an absolute URL on this origin.
 */
export function returnPathFromCallback(callbackURL: unknown, origin: string) {
  if (typeof callbackURL !== "string") return null;
  if (callbackURL.startsWith("/")) return safeReturnPath(callbackURL);
  const prefix = origin.replace(/\/+$/, "");
  return prefix && callbackURL.startsWith(`${prefix}/`)
    ? safeReturnPath(callbackURL.slice(prefix.length))
    : null;
}
