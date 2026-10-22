// The Console's tokens for the app: the brand of docs/design.md (anuntech-brand) on
// iOS's grouped structure (neutral grey background, white sections without borders).
import { useColorScheme } from "react-native";

/** The brand violet: splash, icon, opening. Actions use violet 600, which reads as text on grey. */
export const BRAND_VIOLET = "#6e56ff";

const light = {
  background: "#f6f6f6",
  foreground: "#0d0d0d",
  card: "#ffffff",
  primary: "#5b43f0",
  primaryPressed: "#4a33d6",
  primaryForeground: "#ffffff",
  primaryTint: "rgba(110,86,255,0.10)",
  secondary: "#ececec",
  secondaryForeground: "#0d0d0d",
  muted: "#6b6b6b",
  /** Chevrons, trailing glyphs and empty-state icons: never text. */
  tertiary: "#8a8a8a",
  accent: "#f3f0ff",
  infoEdge: "#d6ccff",
  border: "#e5e5e5",
  separator: "rgba(0,0,0,0.12)",
  /** Disabled buttons, pressed rows, skeletons, the Pix code box. */
  fill: "#ececec",
  field: "#ffffff",
  fieldBorder: "#8a8a8a",
  ring: "#5b43f0",
  success: "#127a46",
  successSoft: "#edf7f1",
  successEdge: "#c6e6d3",
  warning: "#8f5500",
  warningSoft: "#fdf6e8",
  warningEdge: "#f0dcb4",
  destructive: "#c4271c",
  destructiveSoft: "#fdf0ef",
  destructiveEdge: "#f4cdca",
  destructiveSolid: "#c4271c",
  onDestructive: "#ffffff",
  hero: "#0d0d0d",
  heroForeground: "#ffffff",
  heroMuted: "rgba(255,255,255,0.72)",
  heroDanger: "#ff9e97",
  /** Brand marks on dark surfaces (the dot on the summary card, avatars): the violet. */
  brand: BRAND_VIOLET,
  onBrand: "#ffffff",
  shadowCard: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
  shadowFloat: "0 1px 3px rgba(0,0,0,0.06), 0 8px 28px rgba(0,0,0,0.12)",
  dark: false,
};
export type Palette = Omit<typeof light, "dark"> & { dark: boolean };
const dark: Palette = {
  background: "#0d0d0d",
  foreground: "#ececec",
  card: "#171717",
  primary: "#a99bff",
  primaryPressed: "#d6ccff",
  primaryForeground: "#1c1640",
  primaryTint: "rgba(169,155,255,0.16)",
  secondary: "#212121",
  secondaryForeground: "#ececec",
  muted: "#a3a3a3",
  tertiary: "#6b6b6b",
  accent: "#1c1640",
  infoEdge: "#241a66",
  border: "#2b2b2b",
  separator: "rgba(255,255,255,0.14)",
  fill: "#262626",
  field: "#171717",
  fieldBorder: "#6b6b6b",
  ring: "#a99bff",
  success: "#4ad08a",
  successSoft: "#10291b",
  successEdge: "#1f4d33",
  warning: "#f2b453",
  warningSoft: "#2b2110",
  warningEdge: "#574220",
  destructive: "#ff7b72",
  destructiveSoft: "#2d1513",
  destructiveEdge: "#5c2723",
  destructiveSolid: "#c4271c",
  onDestructive: "#ffffff",
  hero: "#212121",
  heroForeground: "#ffffff",
  heroMuted: "rgba(255,255,255,0.72)",
  heroDanger: "#ff9e97",
  brand: BRAND_VIOLET,
  onBrand: "#ffffff",
  shadowCard: "none",
  shadowFloat: "0 8px 28px rgba(0,0,0,0.5)",
  dark: true,
};

/** Icon tiles (Settings style): white glyph on these, in both modes. */
export const tile = {
  violet: BRAND_VIOLET,
  ink: "#0d0d0d",
  teal: "#0f766e",
  amber: "#8f5500",
  green: "#127a46",
  gray: "#6b6b6b",
  red: "#c4271c",
};

export const fonts = {
  regular: "Geist-Regular",
  semibold: "Geist-Medium",
  bold: "Geist-SemiBold",
};
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };
/** Continuous (squircle) corners, as iOS draws them. */
export const rounded = (r: number) => ({ borderRadius: r, borderCurve: "continuous" as const });
/** Gutter 16, blocks 24, forms 20, rows 52, touch targets 44. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, form: 20, block: 24, xl: 32, xxl: 48, touch: 44, row: 52, gutter: 16 };

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

/** A surface that floats: a soft shadow in light mode, a hairline border in dark mode. */
export function raised(palette: Palette, kind: "card" | "float" = "card") {
  return palette.dark
    ? { borderWidth: 1, borderColor: palette.border, ...(kind === "float" ? { boxShadow: palette.shadowFloat } : {}) }
    : { boxShadow: kind === "float" ? palette.shadowFloat : palette.shadowCard };
}
