import { Pressable, View } from "react-native";
import { SymbolView } from "@/components/symbol";
import { rounded, usePalette } from "@/lib/theme";
import { Text } from "./text";

/** A page section's title, with its count and a "Ver todos" link. */
export function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: { label: string; onPress: () => void };
}) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginHorizontal: 4, marginBottom: 8 }}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {count ? (
        <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, ...rounded(999), backgroundColor: palette.secondary, marginLeft: 8, alignItems: "center", justifyContent: "center" }}>
          <Text variant="micro" tone="muted">
            {count}
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {action ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`${action.label}: ${title}`} hitSlop={10} onPress={action.onPress} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text variant="label" tone="primary">
            {action.label}
          </Text>
          <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={palette.primary} accessible={false} />
        </Pressable>
      ) : null}
    </View>
  );
}
