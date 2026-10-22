import { PROFILE_AVATARS } from "./avatar-catalog";
import { isOwnedProfileAvatar } from "./profile-avatar-path";

/** How the app draws a person's picture (the contract's `avatar`). */
export type AvatarView = {
  kind: "illustration" | "photo" | "initials";
  /** Path on the Console: /brand/avatars/<n>.svg, /api/conta/foto?v=… or /api/pessoas/<id>/foto?v=… */
  path: string | null;
  /** Background of an illustration. */
  color: string | null;
};

const ownPhoto =
  /^profile-avatars\/[a-f0-9]{64}\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp)$/;
const initials: AvatarView = { kind: "initials", path: null, color: null };

/**
 * user.image as the app draws it, with the web's rules (IllustratedAvatar and
 * profileAvatarSource): an illustration of the catalog with its background,
 * an uploaded photo through the Console's private routes, or initials. The
 * Blob pathname itself never leaves the server.
 *
 * Without `userId` it is the signed-in person's own picture, served by
 * /api/conta/foto (which checks ownership on read). With `userId` it is that
 * person's picture, served by /api/pessoas/<id>/foto, which checks that the
 * viewer shares a company with them; a photo that is not theirs is initials.
 * The `v` parameter is the file's name, so a new photo is a new URL.
 */
export function avatarView(image: string | null | undefined, userId?: string): AvatarView {
  if (!image) return initials;
  const illustration = PROFILE_AVATARS.find((avatar) => avatar.image === image);
  if (illustration) return { kind: "illustration", path: illustration.image, color: illustration.background };
  const file = ownPhoto.exec(image)?.[1];
  if (!file) return initials;
  if (userId === undefined) return { kind: "photo", path: `/api/conta/foto?v=${file}`, color: null };
  if (!isOwnedProfileAvatar(image, userId)) return initials;
  return { kind: "photo", path: `/api/pessoas/${encodeURIComponent(userId)}/foto?v=${file}`, color: null };
}

/** The illustrations a person can pick, as the app draws them. */
export function catalogAvatars() {
  return PROFILE_AVATARS.map((avatar) => ({ image: avatar.image, path: avatar.image, color: avatar.background }));
}
