import { View } from "react-native";
import { radius, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

type Display = "issued" | "overdue" | "paid" | "scheduled" | "draft" | "expired" | "cancelled";

/** An invoice's situation: open blue, overdue red, paid green, the rest grey. */
export function InvoiceBadge({ display, label }: { display: Display; label: string }) {
  const palette = usePalette();
  const tone =
    display === "overdue" || display === "expired"
      ? { bg: palette.destructiveSoft, fg: palette.destructive }
      : display === "paid"
        ? { bg: palette.successSoft, fg: palette.success }
        : display === "issued"
          ? { bg: palette.accent, fg: palette.primary }
          : { bg: palette.secondary, fg: palette.muted };
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: tone.bg, borderRadius: radius.xl, paddingHorizontal: space.sm, paddingVertical: 2 }}>
      <Text variant="caption" style={{ color: tone.fg }}>
        {label}
      </Text>
    </View>
  );
}
