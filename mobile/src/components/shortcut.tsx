import { Pressable, View } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { radius, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

/** A tile on Início that opens one of the areas outside the tab bar. */
export function Shortcut({
  title,
  detail,
  icon,
  onPress,
}: {
  title: string;
  detail: string;
  icon: SymbolViewProps["name"];
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => ({
        flexBasis: "47%",
        flexGrow: 1,
        backgroundColor: palette.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.lg,
        gap: space.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.lg,
          backgroundColor: palette.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolView name={icon} size={20} tintColor={palette.primary} />
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="label" style={{ fontSize: 16, lineHeight: 22 }}>
          {title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}
