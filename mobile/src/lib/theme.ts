// The Console's tokens for the app: the brand of docs/design.md on iOS's grouped
// structure (cool grey background, white sections without borders).
import { useColorScheme } from "react-native";

const light = {
  background: "#f2f4f7",
  foreground: "#0d1d41",
  card: "#ffffff",
  primary: "#1a428a",
  primaryPressed: "#14366f",
  primaryForeground: "#ffffff",
  primaryTint: "rgba(26,66,138,0.10)",
  secondary: "#eef2f8",
  secondaryForeground: "#244268",
  muted: "#5d6c81",
  /** Chevrons, trailing glyphs and empty-state icons: never text. */
  tertiary: "#8792a6",
  accent: "#edf2fc",
  infoEdge: "#cfdcf3",
  border: "#e0e6ef",
  separator: "rgba(13,29,65,0.12)",
  /** Disabled buttons, pressed rows, skeletons, the Pix code box. */
  fill: "#e8ecf2",
  field: "#ffffff",
  fieldBorder: "#8792a6",
  ring: "#557ac0",
  success: "#23724f",
  successSoft: "#edf8f1",
  successEdge: "#cbe6d5",
  warning: "#8a5a13",
  warningSoft: "#fff8e9",
  warningEdge: "#efdfb7",
  destructive: "#b13942",
  destructiveSoft: "#fff1f2",
  destructiveEdge: "#f2cdd0",
  destructiveSolid: "#b13942",
  onDestructive: "#ffffff",
  hero: "#0d1d41",
  heroForeground: "#ffffff",
  heroMuted: "rgba(255,255,255,0.72)",
  heroDanger: "#ffadb4",
  navy: "#0d1d41",
  yellow: "#e1e666",
  shadowCard: "0 1px 2px rgba(13,29,65,0.04), 0 4px 16px rgba(13,29,65,0.06)",
  shadowFloat: "0 1px 3px rgba(13,29,65,0.06), 0 8px 28px rgba(13,29,65,0.12)",
  dark: false,
};
export type Palette = Omit<typeof light, "dark"> & { dark: boolean };
const dark: Palette = {
  background: "#101722",
  foreground: "#e7edf7",
  card: "#182231",
  primary: "#9ebfff",
  primaryPressed: "#86abf5",
  primaryForeground: "#102448",
  primaryTint: "rgba(158,191,255,0.16)",
  secondary: "#222f42",
  secondaryForeground: "#d6e3f7",
  muted: "#acb9cc",
  tertiary: "#6b7a91",
  accent: "#243b5e",
  infoEdge: "#33507d",
  border: "#364458",
  separator: "rgba(231,237,247,0.14)",
  fill: "#26334a",
  field: "#202c3d",
  fieldBorder: "#6b7a91",
  ring: "#a6c4ff",
  success: "#8bdbaf",
  successSoft: "#143b2b",
  successEdge: "#306a4e",
  warning: "#f1d28b",
  warningSoft: "#392e19",
  warningEdge: "#715a2c",
  destructive: "#ffadb4",
  destructiveSoft: "#40242c",
  destructiveEdge: "#79434e",
  destructiveSolid: "#c2343f",
  onDestructive: "#ffffff",
  hero: "#1d3157",
  heroForeground: "#ffffff",
  heroMuted: "rgba(255,255,255,0.72)",
  heroDanger: "#ffadb4",
  navy: "#0d1d41",
  yellow: "#e1e666",
  shadowCard: "none",
  shadowFloat: "0 8px 28px rgba(0,0,0,0.45)",
  dark: true,
};

/** Icon tiles (Settings style): white glyph on these, in both modes. */
export const tile = {
  blue: "#1a428a",
  navy: "#0d1d41",
  teal: "#0e7c86",
  amber: "#a86a12",
  green: "#23724f",
  gray: "#6b7a90",
  red: "#b13942",
};

export const fonts = {
  regular: "Sofia-Regular",
  semibold: "Sofia-SemiBold",
  bold: "Sofia-Bold",
};
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };
/** Continuous (squircle) corners, as iOS draws them. */
export const rounded = (r: number) => ({ borderRadius: r, borderCurve: "continuous" as const });
/** Gutter 16, blocks 24, forms 20, rows 52, touch targets 44. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, form: 20, block: 24, xl: 32, xxl: 48, touch: 44, row: 52, gutter: 16 };

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

/** A surface that floats: navy shadow in light mode, a hairline border in dark mode. */
export function raised(palette: Palette, kind: "card" | "float" = "card") {
  return palette.dark
    ? { borderWidth: 1, borderColor: palette.border, ...(kind === "float" ? { boxShadow: palette.shadowFloat } : {}) }
    : { boxShadow: kind === "float" ? palette.shadowFloat : palette.shadowCard };
}
