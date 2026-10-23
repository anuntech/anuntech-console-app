import { View } from "react-native";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { usePalette } from "@/lib/theme";
import { Button } from "./button";
import { Text } from "./text";

export type Empty = { icon: SFSymbol; title: string; text: string; action?: { label: string; icon?: SFSymbol; onPress: () => void } };

/** What an empty list means and, when there is one, the next step. */
export function EmptyState({ icon, title, text, action }: Empty) {
  const palette = usePalette();
  return (
    <View style={{ alignItems: "center", paddingTop: 56, paddingHorizontal: 32, gap: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
        <SymbolView name={icon} size={28} tintColor={palette.primary} accessible={false} />
      </View>
      <Text variant="heading" accessibilityRole="header" style={{ textAlign: "center" }}>
        {title}
      </Text>
      <Text variant="subhead" tone="muted" style={{ textAlign: "center", maxWidth: 280 }}>
        {text}
      </Text>
      {action ? (
        <View style={{ marginTop: 8 }}>
          <Button title={action.label} icon={action.icon} variant="secondary" onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}
