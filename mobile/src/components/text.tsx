import { Text as NativeText, type TextProps } from "react-native";
import { fonts, usePalette } from "@/lib/theme";

export type Variant =
  | "display"
  | "largeTitle"
  | "title"
  | "heading"
  | "headline"
  | "body"
  | "money"
  | "subhead"
  | "label"
  | "caption"
  | "micro";

type Size = { fontSize: number; lineHeight: number; font: keyof typeof fonts; tracking?: number; max: number; tabular?: boolean };

/** The type scale, all Sofia: big things bold, rows semibold, reading regular. */
const sizes: Record<Variant, Size> = {
  display: { fontSize: 40, lineHeight: 46, font: "bold", tracking: -1, max: 1.5, tabular: true },
  largeTitle: { fontSize: 34, lineHeight: 41, font: "bold", tracking: -0.6, max: 1.5 },
  title: { fontSize: 28, lineHeight: 34, font: "bold", tracking: -0.5, max: 1.5 },
  heading: { fontSize: 20, lineHeight: 26, font: "semibold", tracking: -0.3, max: 1.5 },
  headline: { fontSize: 17, lineHeight: 22, font: "semibold", tracking: -0.2, max: 2 },
  body: { fontSize: 17, lineHeight: 24, font: "regular", max: 2 },
  money: { fontSize: 17, lineHeight: 22, font: "bold", tracking: -0.2, max: 2, tabular: true },
  subhead: { fontSize: 15, lineHeight: 20, font: "regular", max: 2 },
  label: { fontSize: 15, lineHeight: 20, font: "semibold", max: 2 },
  caption: { fontSize: 13, lineHeight: 18, font: "regular", max: 2 },
  micro: { fontSize: 12, lineHeight: 16, font: "semibold", tracking: 0.1, max: 2 },
};

export type Tone = "foreground" | "muted" | "primary" | "destructive" | "inverse" | "success" | "warning";

/** Sofia in the Console's sizes; text scales with the system setting, up to a cap per size. */
export function Text({
  variant = "body",
  tone = "foreground",
  style,
  ...props
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const palette = usePalette();
  const size = sizes[variant];
  const color = {
    foreground: palette.foreground,
    muted: palette.muted,
    primary: palette.primary,
    destructive: palette.destructive,
    inverse: palette.primaryForeground,
    success: palette.success,
    warning: palette.warning,
  }[tone];
  return (
    <NativeText
      maxFontSizeMultiplier={size.max}
      style={[
        {
          fontFamily: fonts[size.font],
          fontSize: size.fontSize,
          lineHeight: size.lineHeight,
          letterSpacing: size.tracking ?? 0,
          color,
          ...(size.tabular ? { fontVariant: ["tabular-nums"] as const } : {}),
        },
        style,
      ]}
      {...props}
    />
  );
}
