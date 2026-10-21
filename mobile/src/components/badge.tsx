import { View } from "react-native";
import { radius, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

type Status = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";

/**
 * A ticket's situation, in the web's tones (components/chamados/ticket-badges):
 * what needs the team is blue, the client amber, done green, over grey.
 */
export function StatusBadge({ status, label }: { status: Status; label: string }) {
  const palette = usePalette();
  const tone = {
    open: { bg: palette.accent, fg: palette.primary },
    in_progress: { bg: palette.primary, fg: palette.primaryForeground },
    waiting_customer: { bg: palette.warningSoft, fg: palette.warning },
    resolved: { bg: palette.successSoft, fg: palette.success },
    closed: { bg: palette.secondary, fg: palette.muted },
  }[status];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: tone.bg,
        borderRadius: radius.xl,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
      }}
    >
      <Text variant="caption" style={{ color: tone.fg }}>
        {label}
      </Text>
    </View>
  );
}
