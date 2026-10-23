import { View } from "react-native";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import type { ToneName } from "@/lib/status";
import { rounded, tile, usePalette, type Palette } from "@/lib/theme";

/** Soft background and foreground of each tone. */
export function toneColors(palette: Palette, tone: ToneName) {
  return {
    info: { bg: palette.accent, edge: palette.infoEdge, fg: palette.primary },
    attention: { bg: palette.warningSoft, edge: palette.warningEdge, fg: palette.warning },
    good: { bg: palette.successSoft, edge: palette.successEdge, fg: palette.success },
    danger: { bg: palette.destructiveSoft, edge: palette.destructiveEdge, fg: palette.destructive },
    neutral: { bg: palette.secondary, edge: palette.border, fg: palette.muted },
  }[tone];
}

/** A place or an action, Settings style: a white glyph on a colored rounded square. */
export function IconTile({
  icon,
  color = "violet",
  glyph = "#ffffff",
  size = 32,
}: {
  icon: SFSymbol;
  color?: keyof typeof tile;
  glyph?: string;
  size?: number;
}) {
  const palette = usePalette();
  // The ink tile is near-black: in dark mode a hairline keeps it from melting into the row.
  const edge = palette.dark && color === "ink" ? { borderWidth: 1, borderColor: palette.border } : {};
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, ...rounded(size / 4), backgroundColor: tile[color], alignItems: "center", justifyContent: "center", ...edge }}
    >
      <SymbolView name={icon} size={Math.round(size * 0.53)} tintColor={glyph} accessible={false} />
    </View>
  );
}

/** A situation: its symbol in the tone's color on a soft circle. */
export function StatusTile({ icon, tone, size = 32 }: { icon: SFSymbol; tone: ToneName; size?: number }) {
  const palette = usePalette();
  const c = toneColors(palette, tone);
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}
    >
      <SymbolView name={icon} size={Math.round(size * 0.47)} weight="semibold" tintColor={c.fg} accessible={false} />
    </View>
  );
}
