import { authClient } from "./auth";
import { queryClient } from "./api";
import { unregisterPush } from "./push";
import { setLockEnabled } from "./lock";
import { setSignInNotice, type SignInNotice } from "./sign-in-notice";

/**
 * Signs out on this phone: push off, session ended on the server, local data
 * gone. `notice` is shown on the sign-in screen (why the person is there).
 */
export async function signOut(notice?: SignInNotice) {
  await unregisterPush();
  await forgetSession(notice);
}

/**
 * Clears what the app keeps. The Expo client empties its cookie and session
 * cache for any /sign-out call, before the request leaves, so this works
 * even when the session no longer exists (account deleted); the guard in
 * _layout then shows the sign-in.
 */
export async function forgetSession(notice?: SignInNotice) {
  // Set before the session goes: the guard mounts the sign-in right after.
  setSignInNotice(notice ?? null);
  await authClient.signOut().catch(() => undefined);
  await setLockEnabled(false);
  queryClient.clear();
}
