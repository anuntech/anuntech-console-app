import type { ReactNode } from "react";
import { Pressable, View, type AccessibilityActionEvent, type AccessibilityActionInfo } from "react-native";
import { SymbolView } from "expo-symbols";
import { space, usePalette } from "@/lib/theme";
import { Text } from "./text";

/**
 * One line of a grouped list, as in iOS Settings: an optional leading tile,
 * the title and up to two lines under it, a value, and a chevron when it
 * goes somewhere. The whole row is one element for VoiceOver.
 */
export function ListRow({
  title,
  subtitle,
  meta,
  leading,
  value,
  valueTone = "muted",
  money = false,
  trailing,
  titleStyle = "regular",
  tone = "foreground",
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
  testID,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  value?: string;
  valueTone?: "muted" | "foreground" | "destructive" | "primary";
  money?: boolean;
  trailing?: "chevron" | "external" | "none" | ReactNode;
  titleStyle?: "regular" | "semibold";
  tone?: "foreground" | "primary" | "destructive";
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  testID?: string;
}) {
  const palette = usePalette();
  const end = trailing ?? (onPress ? "chevron" : "none");
  const label =
    accessibilityLabel ??
    [title, subtitle, meta, value].filter((part) => typeof part === "string" && part).join(", ");
  const body = (
    <>
      {leading ? <View style={{ marginTop: meta ? 2 : 0 }}>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === "string" ? (
          <Text variant={titleStyle === "semibold" ? "headline" : "body"} tone={tone} numberOfLines={2}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text variant="subhead" tone="muted" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
        {meta ? (
          typeof meta === "string" ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {meta}
            </Text>
          ) : (
            meta
          )
        ) : null}
      </View>
      {value ? (
        <Text variant={money ? "money" : "body"} tone={valueTone} style={{ flexShrink: 0, maxWidth: "55%", textAlign: "right" }}>
          {value}
        </Text>
      ) : null}
      {end === "chevron" || end === "external" ? (
        <SymbolView
          name={end === "chevron" ? "chevron.right" : "arrow.up.right"}
          size={13}
          weight="semibold"
          tintColor={palette.tertiary}
          accessible={false}
        />
      ) : end !== "none" ? (
        end
      ) : null}
    </>
  );
  const rowStyle = {
    minHeight: space.row,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: "row" as const,
    alignItems: meta ? ("flex-start" as const) : ("center" as const),
    gap: space.md,
  };
  if (!onPress && !onLongPress)
    return (
      <View accessible accessibilityLabel={label} testID={testID} style={rowStyle}>
        {body}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? (end === "external" ? "Abre no navegador" : undefined)}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      android_ripple={{ color: palette.fill }}
      style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? palette.fill : "transparent" }]}
    >
      {body}
    </Pressable>
  );
}
