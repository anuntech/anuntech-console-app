import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";
import { radius, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

type Variant = "primary" | "outline" | "ghost" | "destructive";

/** The Console's button: 48 tall, busy state, never smaller than the touch target. */
export function Button({
  title,
  variant = "primary",
  busy = false,
  disabled,
  ...props
}: Omit<PressableProps, "children"> & { title: string; variant?: Variant; busy?: boolean }) {
  const palette = usePalette();
  const off = disabled || busy;
  const colors = {
    primary: { bg: palette.primary, fg: "inverse" as const, border: palette.primary },
    outline: { bg: palette.card, fg: "foreground" as const, border: palette.border },
    ghost: { bg: "transparent", fg: "primary" as const, border: "transparent" },
    destructive: { bg: palette.destructive, fg: "inverse" as const, border: palette.destructive },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy }}
      disabled={off}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        opacity: off ? 0.5 : pressed ? 0.85 : 1,
        alignItems: "center",
        justifyContent: "center",
      })}
      {...props}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {busy && (
          <ActivityIndicator
            color={variant === "primary" || variant === "destructive" ? palette.primaryForeground : palette.primary}
          />
        )}
        <Text
          variant="label"
          tone={colors.fg}
          style={variant === "destructive" ? { color: "#fff" } : undefined}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}
