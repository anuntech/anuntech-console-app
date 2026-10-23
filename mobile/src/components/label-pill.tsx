import { View } from "react-native";
import { labelColors } from "@/lib/tasks";
import { rounded, usePalette } from "@/lib/theme";
import { Text } from "./text";

/** A task's label with its own colour (the same text always has the same one, as on the web). */
export function LabelPill({ label }: { label: string }) {
  const palette = usePalette();
  const c = labelColors(palette, label);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        minHeight: 24,
        paddingHorizontal: 10,
        ...rounded(999),
        borderWidth: 1,
        borderColor: c.edge,
        backgroundColor: c.bg,
      }}
    >
      <Text variant="micro" numberOfLines={1} style={{ color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}

/** The label's colour as a solid dot, centred in a row's 32-point leading slot (the board's filter). */
export function LabelDot({ label }: { label: string }) {
  const palette = usePalette();
  return (
    <View accessible={false} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: labelColors(palette, label).dot }} />
    </View>
  );
}
