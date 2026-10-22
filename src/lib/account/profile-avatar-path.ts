import { createHash } from "node:crypto";

// Pure: where a person's uploaded photo lives on Blob, without the storage
// client, so the API's avatar view and the unit tests can use it.

export function avatarPrefix(userId: string) {
  return `profile-avatars/${createHash("sha256").update(userId).digest("hex")}/`;
}

/** The private pathname of a photo `userId` uploaded (profile-avatars/<sha256>/<uuid>.webp). */
export function isOwnedProfileAvatar(
  image: string | null | undefined,
  userId: string,
): image is string {
  if (!image?.startsWith(avatarPrefix(userId))) return false;
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/.test(
    image.slice(avatarPrefix(userId).length),
  );
}
