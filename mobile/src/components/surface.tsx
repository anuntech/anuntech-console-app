import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Platform, ScrollView, View, type ViewProps } from "react-native";
import Animated from "react-native-reanimated";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { enter } from "@/lib/motion";
import { raised as raisedStyle, rounded, space, usePalette } from "@/lib/theme";
import { ListRow } from "./list-row";
import { Text } from "./text";

/** A scrolling page on the grouped background, under the native header. */
export function Screen({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space.lg, gap: space.block, paddingBottom: space.block * 2 }}
    >
      {children}
    </ScrollView>
  );
}

/**
 * A white card without a border. `raised` floats it (navy shadow) for what
 * asks for attention; `tone` edges it amber or green.
 */
export function Card({ style, raised, tone, ...props }: ViewProps & { raised?: boolean; tone?: "warning" | "success" }) {
  const palette = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: palette.card,
          ...rounded(24),
          padding: space.lg,
          gap: space.md,
          ...(palette.dark ? { borderWidth: 1, borderColor: palette.border } : {}),
          ...(raised ? raisedStyle(palette) : {}),
          ...(tone ? { borderWidth: 1, borderColor: tone === "warning" ? palette.warningEdge : palette.successEdge } : {}),
        },
        style,
      ]}
      {...props}
    />
  );
}

/** @deprecated The old list line; use ListRow inside a Section. */
export function Row({
  title,
  detail,
  onPress,
  onLongPress,
  tone = "foreground",
  accessory,
}: {
  title: string;
  detail?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: "foreground" | "destructive";
  accessory?: ReactNode;
}) {
  return <ListRow title={title} subtitle={detail} onPress={onPress} onLongPress={onLongPress} tone={tone} trailing={accessory} />;
}

type NoticeKind = "info" | "success" | "warning" | "error";

/** Feedback with an icon and words, never color alone; VoiceOver reads it when it appears. */
export function Notice({ kind, title, children }: { kind: NoticeKind; title?: string; children: ReactNode }) {
  const palette = usePalette();
  const look: Record<NoticeKind, { bg: string; edge: string; fg: string; icon: SFSymbol }> = {
    info: { bg: palette.accent, edge: palette.infoEdge, fg: palette.primary, icon: "info.circle.fill" },
    success: { bg: palette.successSoft, edge: palette.successEdge, fg: palette.success, icon: "checkmark.seal.fill" },
    warning: { bg: palette.warningSoft, edge: palette.warningEdge, fg: palette.warning, icon: "exclamationmark.circle.fill" },
    error: { bg: palette.destructiveSoft, edge: palette.destructiveEdge, fg: palette.destructive, icon: "xmark.octagon.fill" },
  };
  const c = look[kind];
  const text = typeof children === "string" ? children : null;
  useEffect(() => {
    if (Platform.OS === "ios" && (kind === "error" || kind === "warning" || kind === "success") && (text || title))
      AccessibilityInfo.announceForAccessibilityWithOptions([title, text].filter(Boolean).join(". "), { queue: true });
  }, [kind, text, title]);
  return (
    <Animated.View
      entering={enter}
      accessible
      accessibilityRole={kind === "error" ? "alert" : "text"}
      style={{ flexDirection: "row", gap: 10, padding: 14, ...rounded(16), borderWidth: 1, borderColor: c.edge, backgroundColor: c.bg }}
    >
      <SymbolView name={c.icon} size={18} tintColor={c.fg} accessible={false} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="label">{title}</Text> : null}
        <Text variant="subhead" tone={kind === "error" ? "destructive" : "foreground"}>
          {children}
        </Text>
      </View>
    </Animated.View>
  );
}
