/** Public, bundled illustrations. Never accept arbitrary image URLs. */
export const PROFILE_AVATARS = Array.from({ length: 89 }, (_, index) => ({
  image: `/brand/avatars/avatar-${String(index + 1).padStart(2, "0")}.svg`,
  label: `Avatar ${index + 1}`,
}));

export function isCatalogAvatar(value: unknown): boolean {
  return (
    typeof value === "string" &&
    PROFILE_AVATARS.some((avatar) => avatar.image === value)
  );
}
