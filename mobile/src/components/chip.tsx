import { Pressable, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { haptic } from "@/lib/haptics";
import { rounded, usePalette } from "@/lib/theme";
import { Text } from "./text";

/** One option of a scrollable set (folders, companies): selected is filled, with a check. */
export function Chip({
  label,
  selected,
  onPress,
  group,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Read by VoiceOver as the hint: what the set is. */
  group?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={group}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: 14,
        ...rounded(999),
        borderWidth: selected ? 0 : 1,
        borderColor: palette.border,
        backgroundColor: selected ? palette.primary : pressed ? palette.fill : palette.card,
        justifyContent: "center",
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {selected ? <SymbolView name="checkmark" size={12} weight="bold" tintColor={palette.primaryForeground} accessible={false} /> : null}
        <Text variant="label" style={{ color: selected ? palette.primaryForeground : palette.foreground }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
