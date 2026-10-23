/**
 * The brand's avatars, half smooth and half pixel, in the brand colors: abstract shapes drawn in code
 * (anuntech-brand scripts/avatars.mjs) and objects drawn with AI (anuntech-brand art/avatars/ia). Each
 * sits inside the window the shared crop shows (1.75× from 50% / 30%), so the web and the app draw them
 * the same way.
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
  ["marca-25.png", "Planeta", "#191342"],
  ["marca-26.png", "Foguete", "#694FFD"],
  ["marca-27.png", "Broto", "#F1EDFD"],
  ["marca-28.png", "Montanha", "#0B0B0A"],
  ["marca-29.png", "Lâmpada", "#F1EEFD"],
  ["marca-30.png", "Nuvem", "#0B0B0B"],
  ["marca-31.png", "Globo", "#D7CFFD"],
  ["marca-32.png", "Conversa", "#EAEAEA"],
  ["marca-33.png", "Código", "#18133F"],
  ["marca-34.png", "Engrenagem", "#6A4DFC"],
  ["marca-35.png", "Chave", "#F1EEFD"],
  ["marca-36.png", "Bússola", "#0B0A0A"],
  ["marca-37.png", "Lua", "#D4CBFD"],
  ["marca-38.png", "Coroa", "#EBEBEA"],
  ["marca-39.png", "Diamante", "#17123F"],
  ["marca-40.png", "Avião de papel", "#6A50FC"],
  ["marca-41.png", "Nota musical", "#F1EDFD"],
  ["marca-42.png", "Câmera", "#0B0B0B"],
  ["marca-43.png", "Livro", "#D4CBFD"],
  ["marca-44.png", "Âncora", "#EBEBEB"],
  ["marca-45.png", "Troféu", "#17113E"],
  ["marca-46.png", "Quebra-cabeça", "#6B52FD"],
  ["marca-47.png", "Flor", "#F1EEFD"],
  ["marca-48.png", "Café", "#0A0A0A"],
];

/** Public, bundled illustrations. Never accept arbitrary image URLs. */
export const PROFILE_AVATARS = BRAND_AVATARS.map(([file, title, background]) => ({
  image: `/brand/avatars/${file}`,
  label: title,
  background,
}));

export type ProfileAvatar = (typeof PROFILE_AVATARS)[number];

/**
 * The illustrated people (avatar-01 … avatar-89) left the catalog. People who still have one in
 * user.image see a brand avatar instead, always the same one for the same file, until they pick again.
 */
const retired = /^\/brand\/avatars\/avatar-(\d{2})\.svg$/;

/** The catalog entry a stored user.image draws, including the retired illustrations. */
export function catalogAvatar(value: unknown): ProfileAvatar | null {
  if (typeof value !== "string") return null;
  const current = PROFILE_AVATARS.find((avatar) => avatar.image === value);
  if (current) return current;
  const number = Number(retired.exec(value)?.[1]);
  if (!(number >= 1 && number <= 89)) return null;
  return PROFILE_AVATARS[(number - 1) % PROFILE_AVATARS.length];
}

/** A stored user.image that draws as an illustration. */
export function isCatalogAvatar(value: unknown): boolean {
  return catalogAvatar(value) !== null;
}

/** An illustration a person can pick now: only the current catalog. */
export function isPickableAvatar(value: unknown): boolean {
  return typeof value === "string" && PROFILE_AVATARS.some((avatar) => avatar.image === value);
}
