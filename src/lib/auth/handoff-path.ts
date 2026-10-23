/**
 * Where the app's session hand-off may land on the web (the "next" of
 * account.openWeb): one Console page on this origin, never another site.
 *
 * Only a relative path that starts with a single "/", with no backslash, no
 * control or blank characters and nothing under /api (the hand-off itself and
 * every endpoint live there). The value is parsed against a fixed origin and
 * must stay on it; what comes back is the normalized path, query and fragment,
 * so the redirect never carries something the check did not see.
 *
 * Pure: the procedure, the auth endpoint and the tests use it.
 */
export const HANDOFF_PATH_MAX = 1024;

export function safeHandoffPath(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > HANDOFF_PATH_MAX) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // Backslashes turn into slashes in browsers ("/\evil.com"); blanks and controls hide tricks.
  if (/[\\\s\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, "https://console.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://console.invalid") return null;
  const path = url.pathname;
  if (path.startsWith("//") || /^\/api(\/|$)/i.test(path)) return null;
  return `${path}${url.search}${url.hash}`;
}
