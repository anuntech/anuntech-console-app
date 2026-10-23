import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { SymbolView } from "@/components/symbol";
import { haptic } from "@/lib/haptics";
import { space, usePalette } from "@/lib/theme";
import { Text } from "./text";

/**
 * The web's consent checkbox: a box and the sentence, one tap target that
 * VoiceOver reads as a checkbox with the whole sentence.
 */
export function ConsentRow({
  checked,
  onChange,
  label,
  disabled,
  testID,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The sentence as plain words, for VoiceOver. */
  label: string;
  disabled?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        haptic.select();
        onChange(!checked);
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.md,
        minHeight: space.touch,
        paddingVertical: space.xs,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <SymbolView
        name={checked ? "checkmark.square.fill" : "square"}
        size={24}
        tintColor={checked ? palette.primary : palette.fieldBorder}
        accessible={false}
        style={{ width: 24, height: 24 }}
      />
      <Text variant="subhead" style={{ flex: 1 }}>
        {children}
      </Text>
    </Pressable>
  );
}
