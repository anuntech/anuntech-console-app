import { Platform, Pressable } from "react-native";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { fonts, usePalette } from "./theme";

/**
 * The header every stack shares, chevron-only back. iOS: transparent, the
 * system draws its glass and the content scrolls under it. Android has no
 * automatic inset for that, so its header is solid and the content starts below.
 */
export function useStackOptions() {
  const palette = usePalette();
  return {
    headerTransparent: Platform.OS === "ios",
    headerStyle: Platform.OS === "android" ? { backgroundColor: palette.background } : undefined,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    headerTintColor: palette.foreground,
    headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: palette.foreground },
    headerLargeTitleStyle: { fontFamily: fonts.bold, fontSize: 34, color: palette.foreground },
    contentStyle: { backgroundColor: palette.background },
  } as const;
}

/** An icon-only button for the header; the system draws the glass circle around it. */
export function HeaderIconButton({
  symbol,
  label,
  onPress,
  tint,
  testID,
}: {
  symbol: SFSymbol;
  label: string;
  onPress: () => void;
  tint?: "foreground" | "primary";
  testID?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} hitSlop={12} onPress={onPress} style={{ padding: 4 }}>
      <SymbolView name={symbol} size={20} weight="medium" tintColor={tint === "primary" ? palette.primary : palette.foreground} accessible={false} />
    </Pressable>
  );
}
