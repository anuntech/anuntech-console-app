import { authClient } from "./auth";
import { queryClient } from "./api";
import { unregisterPush } from "./push";
import { setLockEnabled } from "./lock";

/** Signs out on this phone: push off, session ended on the server, local data gone. */
export async function signOut() {
  await unregisterPush();
  await forgetSession();
}

/**
 * Clears what the app keeps. The Expo client empties its cookie and session
 * cache for any /sign-out call, before the request leaves, so this works
 * even when the session no longer exists (account deleted); the guard in
 * _layout then shows the sign-in.
 */
export async function forgetSession() {
  await authClient.signOut().catch(() => undefined);
  await setLockEnabled(false);
  queryClient.clear();
}
