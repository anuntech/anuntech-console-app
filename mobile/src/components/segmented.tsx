import type { ComponentType } from "react";
import NativeSegmented, { type SegmentedControlProps } from "@react-native-segmented-control/segmented-control";
import { haptic } from "@/lib/haptics";
import { fonts, usePalette } from "@/lib/theme";

// The package ships a class type React 19 typings reject; the component itself is fine.
const SegmentedControl = NativeSegmented as unknown as ComponentType<SegmentedControlProps>;

/** The native segmented filter (Em aberto | Todos), with a tick of haptics. */
export function Segmented({
  values,
  selectedIndex,
  onChange,
  accessibilityLabel,
}: {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  return (
    <SegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      accessibilityLabel={accessibilityLabel}
      onChange={(event: { nativeEvent: { selectedSegmentIndex: number } }) => {
        haptic.select();
        onChange(event.nativeEvent.selectedSegmentIndex);
      }}
      style={{ height: 36 }}
      fontStyle={{ fontFamily: fonts.semibold, fontSize: 14, color: palette.foreground }}
      activeFontStyle={{ fontFamily: fonts.semibold, fontSize: 14, color: palette.foreground }}
      appearance={palette.dark ? "dark" : "light"}
    />
  );
}
