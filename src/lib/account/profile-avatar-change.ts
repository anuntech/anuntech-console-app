import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { session, user } from "@/db/schema";
import { isPickableAvatar } from "./avatar-catalog";
import { randomProfileAvatar } from "./default-avatar";
import {
  MAX_AVATAR_BYTES,
  ProfileAvatarError,
  deleteProfileAvatar,
  normalizeProfileAvatar,
  storeProfileAvatar,
} from "./profile-avatar";

/*
 * Changing the profile picture, for the web (/api/conta/foto) and the app
 * (/api/v1/conta/foto and profile.*). The callers check the session first
 * (verified e-mail and allowedEmail); these re-check it inside the write.
 */

type Current = { user: { id: string }; session: { id: string } };

/** Swaps user.image while the session is still live; returns the previous value. */
export async function replaceProfileAvatar(current: Current, image: string | null) {
  return db.transaction(async (tx) => {
    const [person] = await tx
      .select({ image: user.image, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, current.user.id))
      .for("update");
    const [activeSession] = await tx
      .select({ id: session.id })
      .from(session)
      .where(
        and(
          eq(session.id, current.session.id),
          eq(session.userId, current.user.id),
          gt(session.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!person?.emailVerified || !activeSession)
      throw new ProfileAvatarError(
        "Entre novamente para alterar sua foto.",
        401,
      );
    await tx
      .update(user)
      .set({ image, updatedAt: new Date() })
      .where(eq(user.id, current.user.id));
    return person.image;
  });
}

/** Deletes an uploaded photo that is no longer referenced. Never throws. */
export async function cleanupProfileAvatar(image: string | null, userId: string) {
  if (!image) return;
  try {
    await deleteProfileAvatar(image, userId);
  } catch {
    // Storage cleanup must never roll back the account's committed reference.
    console.warn("profile_avatar_cleanup_failed");
  }
}

/**
 * Normalizes, stores and selects an uploaded photo; returns its pathname.
 * A stored photo the account did not take is deleted again.
 */
export async function saveProfilePhoto(
  current: Current,
  bytes: Buffer,
  contentType: string,
  maxInput = MAX_AVATAR_BYTES,
) {
  const image = await normalizeProfileAvatar(bytes, contentType, maxInput);
  const uploaded = await storeProfileAvatar(current.user.id, image);
  let previous: string | null;
  try {
    previous = await replaceProfileAvatar(current, uploaded);
  } catch (error) {
    await cleanupProfileAvatar(uploaded, current.user.id);
    throw error;
  }
  await cleanupProfileAvatar(previous, current.user.id);
  return uploaded;
}

/** Selects an illustration of the catalog (the whitelist: never an arbitrary URL). */
export async function chooseCatalogAvatar(current: Current, image: unknown) {
  if (typeof image !== "string" || !isPickableAvatar(image))
    throw new ProfileAvatarError("Selecione um avatar válido.", 400);
  const previous = await replaceProfileAvatar(current, image);
  await cleanupProfileAvatar(previous, current.user.id);
  return image;
}

/** Drops the uploaded photo: the profile goes back to a random illustration. */
export async function removeProfilePhoto(current: Current) {
  const image = randomProfileAvatar();
  const previous = await replaceProfileAvatar(current, image);
  await cleanupProfileAvatar(previous, current.user.id);
  return image;
}
