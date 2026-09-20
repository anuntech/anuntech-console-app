import "server-only";

// Request-scoped Better Auth context: do not persist provider claims or expose
// them in session DTOs. Recheck after session creation to close a concurrent
// primary-email change between OAuth validation and the endpoint's response.
const verifiedEmails = new WeakMap<object, string>();

export function rememberOAuthEmail(context: object, email: string) {
  verifiedEmails.set(context, email);
}

export function getOAuthEmail(context: object) {
  return verifiedEmails.get(context);
}
