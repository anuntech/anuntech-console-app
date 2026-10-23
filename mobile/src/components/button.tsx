import { ActivityIndicator, View, type PressableProps } from "react-native";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { rounded, space, usePalette } from "@/lib/theme";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "plain" | "destructive" | "outline" | "ghost";

/**
 * The app's button: a capsule 50 tall (36 when small, still a 44 target).
 * Disabled is a grey fill with readable text, never a faded button; busy keeps
 * its color and shows a spinner next to the label the caller passes.
 */
export function Button({
  title,
  variant = "primary",
  size = "regular",
  icon,
  trailingIcon,
  busy = false,
  disabled,
  ...props
}: Omit<PressableProps, "children" | "style"> & {
  title: string;
  variant?: Variant;
  size?: "regular" | "small";
  icon?: SFSymbol;
  trailingIcon?: SFSymbol;
  busy?: boolean;
}) {
  const palette = usePalette();
  const off = disabled || busy;
  const kind = variant === "outline" ? "secondary" : variant === "ghost" ? "plain" : variant;
  const colors = {
    primary: { bg: palette.primary, pressed: palette.primaryPressed, fg: palette.primaryForeground },
    secondary: { bg: palette.primaryTint, pressed: palette.fill, fg: palette.primary },
    plain: { bg: "transparent", pressed: "transparent", fg: palette.primary },
    destructive: { bg: palette.destructiveSolid, pressed: palette.destructiveSolid, fg: palette.onDestructive },
  }[kind];
  const disabledLook = disabled && !busy;
  const fg = disabledLook ? palette.muted : colors.fg;
  const small = size === "small";
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy }}
      disabled={off}
      hitSlop={small ? 4 : undefined}
      style={({ pressed }) => ({
        minHeight: small ? 36 : kind === "plain" ? 44 : 50,
        paddingHorizontal: small ? 14 : 20,
        ...rounded(999),
        backgroundColor: disabledLook ? (kind === "plain" ? "transparent" : palette.fill) : pressed ? colors.pressed : colors.bg,
        opacity: kind === "plain" && pressed ? 0.6 : 1,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: small ? "flex-start" : undefined,
      })}
      {...props}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {busy ? (
          <ActivityIndicator size="small" color={fg} />
        ) : icon ? (
          <SymbolView name={icon} size={small ? 15 : 17} weight="semibold" tintColor={fg} accessible={false} />
        ) : null}
        <Text variant={small ? "label" : "headline"} style={{ color: fg }}>
          {title}
        </Text>
        {trailingIcon && !busy ? (
          <SymbolView name={trailingIcon} size={small ? 12 : 14} weight="semibold" tintColor={fg} accessible={false} />
        ) : null}
      </View>
    </PressableScale>
  );
}
