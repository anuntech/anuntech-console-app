import type { ReactNode } from "react";
import { View } from "react-native";
import type { SFSymbol } from "expo-symbols";
import type { ToneName } from "@/lib/status";
import type { tile } from "@/lib/theme";
import { ListRow } from "./list-row";
import { Pill } from "./pill";
import { Text } from "./text";
import { IconTile } from "./tile";

/** Each kind of record keeps one symbol and one tile color everywhere (Início shortcuts, lists). */
export const recordLooks: Record<"contract" | "quote" | "project", { icon: SFSymbol; color: keyof typeof tile }> = {
  contract: { icon: "doc.text.fill", color: "teal" },
  quote: { icon: "list.bullet.rectangle.portrait.fill", color: "amber" },
  project: { icon: "square.grid.2x2.fill", color: "blue" },
};

/**
 * A contract, quote or project in a grouped list: its tile, the title, the
 * details, the situation as a pill and, for quotes, the amount at the end.
 */
export function RecordRow({
  kind,
  title,
  details,
  status,
  value,
  note,
  onPress,
  children,
}: {
  kind: keyof typeof recordLooks;
  title: string;
  details?: string;
  status?: { label: string; tone: ToneName };
  /** Money shown at the end of the row. */
  value?: string;
  /** A last line under the pill, read with the row (a project's progress in words). */
  note?: string;
  onPress: () => void;
  /** Something drawn under the pill (a project's progress bar); VoiceOver reads `note` instead. */
  children?: ReactNode;
}) {
  const look = recordLooks[kind];
  const extra = status || children || note;
  return (
    <ListRow
      leading={<IconTile icon={look.icon} color={look.color} />}
      title={
        <Text variant="headline" numberOfLines={2}>
          {title}
        </Text>
      }
      subtitle={details}
      meta={
        extra ? (
          <View style={{ marginTop: 6, gap: 8 }}>
            {status ? <Pill label={status.label} tone={status.tone} /> : null}
            {children}
            {note ? (
              <Text variant="caption" tone="muted">
                {note}
              </Text>
            ) : null}
          </View>
        ) : undefined
      }
      value={value}
      money={!!value}
      onPress={onPress}
      accessibilityLabel={[title, status?.label, details, note, value].filter(Boolean).join(", ")}
    />
  );
}
