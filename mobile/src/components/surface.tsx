import type { ReactNode } from "react";
import { Pressable, ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { radius, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

/** A scrolling page on the Console's background. */
export function Screen({ children, edges }: { children: ReactNode; edges?: ("top" | "bottom")[] }) {
  const palette = usePalette();
  return (
    <SafeAreaView edges={edges ?? ["top"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, gap: space.block, paddingBottom: space.block * 2 }}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** A card (rounded-xl on the web). */
export function Card({ style, ...props }: ViewProps) {
  const palette = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: palette.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: palette.border,
          padding: space.lg,
          gap: space.md,
        },
        style,
      ]}
      {...props}
    />
  );
}

/** One line of a list: what it is, its value, and where it goes when tapped. */
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
  const palette = usePalette();
  const content = (
    <View style={{ minHeight: space.touch, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm }}>
      <View style={{ flex: 1 }}>
        <Text variant="body" tone={tone}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      {accessory}
      {onPress && !accessory ? (
        <Text tone="muted" accessible={false} importantForAccessibility="no">
          ›
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, borderRadius: radius.md })}
      android_ripple={{ color: palette.accent }}
    >
      {content}
    </Pressable>
  );
}

/** Feedback with text, never color alone: error or information. */
export function Notice({ kind, children }: { kind: "error" | "info"; children: ReactNode }) {
  const palette = usePalette();
  const error = kind === "error";
  return (
    <View
      accessibilityRole={error ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: error ? palette.destructiveEdge : palette.border,
        backgroundColor: error ? palette.destructiveSoft : palette.secondary,
        padding: space.md,
      }}
    >
      <Text variant="caption" tone={error ? "destructive" : "foreground"}>
        {children}
      </Text>
    </View>
  );
}
