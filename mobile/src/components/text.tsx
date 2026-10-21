import { Text as NativeText, type TextProps } from "react-native";
import { fonts, usePalette } from "@/lib/theme";

type Variant = "title" | "heading" | "body" | "label" | "caption";
const sizes: Record<Variant, { fontSize: number; lineHeight: number; font: keyof typeof fonts; tracking?: number }> = {
  title: { fontSize: 28, lineHeight: 34, font: "semibold", tracking: -0.5 },
  heading: { fontSize: 18, lineHeight: 24, font: "semibold", tracking: -0.2 },
  body: { fontSize: 16, lineHeight: 24, font: "regular" },
  label: { fontSize: 14, lineHeight: 20, font: "semibold" },
  caption: { fontSize: 13, lineHeight: 18, font: "regular" },
};

/** Sofia in the Console's sizes; text scales with the system setting. */
export function Text({
  variant = "body",
  tone = "foreground",
  style,
  ...props
}: TextProps & {
  variant?: Variant;
  tone?: "foreground" | "muted" | "primary" | "destructive" | "inverse";
}) {
  const palette = usePalette();
  const size = sizes[variant];
  const color = {
    foreground: palette.foreground,
    muted: palette.muted,
    primary: palette.primary,
    destructive: palette.destructive,
    inverse: palette.primaryForeground,
  }[tone];
  return (
    <NativeText
      maxFontSizeMultiplier={1.6}
      style={[
        {
          fontFamily: fonts[size.font],
          fontSize: size.fontSize,
          lineHeight: size.lineHeight,
          letterSpacing: size.tracking ?? 0,
          color,
        },
        style,
      ]}
      {...props}
    />
  );
}
