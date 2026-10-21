// The Console's tokens (docs/design.md, src/app/globals.css), for the app.
import { useColorScheme } from "react-native";

const light = {
  background: "#fafafa",
  foreground: "#0d1d41",
  card: "#ffffff",
  primary: "#1a428a",
  primaryForeground: "#ffffff",
  secondary: "#eef2f8",
  secondaryForeground: "#244268",
  muted: "#5d6c81",
  accent: "#edf2fc",
  border: "#e0e6ef",
  field: "#f0f3f8",
  fieldBorder: "#d5dce7",
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
  navy: "#0d1d41",
  yellow: "#e1e666",
};
export type Palette = typeof light;
const dark: Palette = {
  background: "#101722",
  foreground: "#e7edf7",
  card: "#182231",
  primary: "#9ebfff",
  primaryForeground: "#102448",
  secondary: "#222f42",
  secondaryForeground: "#d6e3f7",
  muted: "#acb9cc",
  accent: "#243b5e",
  border: "#364458",
  field: "#202c3d",
  fieldBorder: "#41516a",
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
  navy: "#0d1d41",
  yellow: "#e1e666",
};

export const fonts = {
  regular: "Sofia-Regular",
  semibold: "Sofia-SemiBold",
  bold: "Sofia-Bold",
};
export const radius = { sm: 6, md: 8, lg: 12, xl: 18 };
/** Space between blocks (24) and inside forms (20), as on the web; touch targets of 44. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, form: 20, block: 24, touch: 44 };

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}
