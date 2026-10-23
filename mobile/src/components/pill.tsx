import { View } from "react-native";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import type { ToneName } from "@/lib/status";
import { rounded, usePalette } from "@/lib/theme";
import { Text } from "./text";
import { toneColors } from "./tile";

/** A situation in words, with its tone and (optionally) its symbol. */
export function Pill({ label, tone = "neutral", icon }: { label: string; tone?: ToneName; icon?: SFSymbol }) {
  const palette = usePalette();
  const c = toneColors(palette, tone);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        minHeight: 24,
        paddingLeft: icon ? 8 : 10,
        paddingRight: 10,
        ...rounded(999),
        borderWidth: 1,
        borderColor: c.edge,
        backgroundColor: c.bg,
      }}
    >
      {icon ? <SymbolView name={icon} size={11} weight="semibold" tintColor={c.fg} accessible={false} /> : null}
      <Text variant="micro" style={{ color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}
