/**
 * A word for the sign-in screen when the app sends the person back to it on
 * purpose (the main e-mail changed and every session ended), with the
 * address to pre-fill. Kept in memory only: it is for the next screen.
 */
export type SignInNotice = { message: string; email?: string };

let pending: SignInNotice | null = null;

export function setSignInNotice(notice: SignInNotice | null) {
  pending = notice;
}
/** Read without clearing, so a double render still sees it; clear in an effect. */
export function peekSignInNotice() {
  return pending;
}
export function clearSignInNotice() {
  pending = null;
}
