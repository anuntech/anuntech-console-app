// Stable, varied backgrounds: choosing an avatar keeps its color across reloads.
const backgrounds = [
  "#DCE8FF",
  "#F9DDDF",
  "#D9EDE1",
  "#F8E8C5",
  "#E8DFF6",
  "#D4EDF0",
  "#F6DFCE",
  "#DFE9CF",
  "#E1E3F8",
  "#F3DFED",
  "#D1E8E5",
  "#F4EDCF",
];
function backgroundFor(index: number) {
  let value = Math.imul(index + 1, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return backgrounds[(value >>> 0) % backgrounds.length];
}

/** Public, bundled illustrations. Never accept arbitrary image URLs. */
export const PROFILE_AVATARS = Array.from({ length: 89 }, (_, index) => ({
  image: `/brand/avatars/avatar-${String(index + 1).padStart(2, "0")}.svg`,
  label: `Avatar ${index + 1}`,
  background: backgroundFor(index),
}));

export function isCatalogAvatar(value: unknown): boolean {
  return (
    typeof value === "string" &&
    PROFILE_AVATARS.some((avatar) => avatar.image === value)
  );
}
