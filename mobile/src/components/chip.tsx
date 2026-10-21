import { Pressable } from "react-native";
import { radius, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

/** One choice among a few (filters, kinds): selected is filled. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: space.md,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: selected ? palette.primary : palette.border,
        backgroundColor: selected ? palette.accent : palette.card,
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="label" tone={selected ? "primary" : "foreground"}>
        {label}
      </Text>
    </Pressable>
  );
}
