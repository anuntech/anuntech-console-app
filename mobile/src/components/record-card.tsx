import type { ToneName } from "@/lib/status";
import { Pill } from "./pill";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { radius, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

/** A tappable card for a record in a list: a tag, a title, details and an optional corner value. */
export function RecordCard({
  title,
  tag,
  corner,
  details,
  onPress,
  children,
}: {
  title: string;
  tag?: ReactNode;
  corner?: string;
  details?: string;
  onPress: () => void;
  children?: ReactNode;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, details].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: palette.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.lg,
        gap: space.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {tag || corner ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm }}>
          <View style={{ flexShrink: 1 }}>{tag}</View>
          {corner ? (
            <Text variant="label" style={{ fontVariant: ["tabular-nums"] }}>
              {corner}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text variant="label" numberOfLines={2} style={{ fontSize: 16, lineHeight: 22 }}>
        {title}
      </Text>
      {details ? (
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {details}
        </Text>
      ) : null}
      {children}
    </Pressable>
  );
}

/** A situation in words, in its tone. */
export function Tag({ label, tone = "neutral" }: { label: string; tone?: ToneName }) {
  return <Pill label={label} tone={tone} />;
}
