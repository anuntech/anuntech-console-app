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

/**
 * The brand's avatars (anuntech-brand scripts/avatars.mjs): abstract shapes, half smooth and half pixel,
 * in the brand colors. Each is drawn inside the window the shared crop shows (1.75× from 50% / 30%), so
 * the web and the app draw them as they draw the illustrations below.
 */
const BRAND_AVATARS: [file: string, title: string, background: string][] = [
  ["marca-01.svg", "Círculo violeta", "#6E56FF"],
  ["marca-02.svg", "Círculo escuro", "#0d0d0d"],
  ["marca-03.svg", "Esfera", "#F3F0FF"],
  ["marca-04.svg", "Quadrado", "#ececec"],
  ["marca-05.svg", "Triângulo", "#1C1640"],
  ["marca-06.svg", "Losango", "#D6CCFF"],
  ["marca-07.svg", "Anel", "#6E56FF"],
  ["marca-08.svg", "Hexágono", "#0d0d0d"],
  ["marca-09.svg", "Mais", "#F3F0FF"],
  ["marca-10.svg", "Estrela", "#1C1640"],
  ["marca-11.svg", "Raio", "#ececec"],
  ["marca-12.svg", "Seta", "#6E56FF"],
  ["marca-13.svg", "Arco", "#D6CCFF"],
  ["marca-14.svg", "Gota", "#0d0d0d"],
  ["marca-15.svg", "Cápsula", "#F3F0FF"],
  ["marca-16.svg", "Coração", "#6E56FF"],
  ["marca-17.svg", "Dupla", "#ececec"],
  ["marca-18.svg", "Blocos", "#F3F0FF"],
  ["marca-19.svg", "Dissolve", "#1C1640"],
  ["marca-20.svg", "Ondas", "#0d0d0d"],
  ["marca-21.svg", "Gradiente", "#D6CCFF"],
  ["marca-22.svg", "Órbita", "#6E56FF"],
  ["marca-23.svg", "Bauhaus", "#ececec"],
  ["marca-24.svg", "Estrela de cinco", "#0d0d0d"],
];

/** Public, bundled illustrations. Never accept arbitrary image URLs. The brand's come first in the picker. */
export const PROFILE_AVATARS = [
  ...BRAND_AVATARS.map(([file, title, background]) => ({
    image: `/brand/avatars/${file}`,
    label: title,
    background,
  })),
  ...Array.from({ length: 89 }, (_, index) => ({
    image: `/brand/avatars/avatar-${String(index + 1).padStart(2, "0")}.svg`,
    label: `Avatar ${index + 1}`,
    background: backgroundFor(index),
  })),
];

export function isCatalogAvatar(value: unknown): boolean {
  return (
    typeof value === "string" &&
    PROFILE_AVATARS.some((avatar) => avatar.image === value)
  );
}
