import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { fonts, rounded, space, usePalette, type Palette } from "@/lib/theme";
import { Text } from "./text";

/**
 * A white group of rows on the grey background, with hairlines between them
 * (indented past the leading tile) and an optional header and footer.
 */
export function Section({
  header,
  footer,
  inset = 0,
  indent = 60,
  children,
  style,
}: {
  header?: string;
  footer?: string;
  /** Horizontal margin when the screen has no padding of its own. */
  inset?: number;
  /** Where the hairline starts: 60 past a leading tile, 16 without one. */
  indent?: number;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const palette = usePalette();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[{ marginHorizontal: inset }, style]}>
      {header ? (
        <Text variant="caption" tone="muted" accessibilityRole="header" style={{ fontFamily: fonts.semibold, marginHorizontal: 16, marginBottom: 6 }}>
          {header}
        </Text>
      ) : null}
      <View style={{ backgroundColor: palette.card, ...rounded(24), overflow: "hidden", ...(palette.dark ? { borderWidth: 1, borderColor: palette.border } : {}) }}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <View style={{ marginLeft: indent, height: StyleSheet.hairlineWidth, backgroundColor: palette.separator }} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="caption" tone="muted" style={{ marginHorizontal: 16, marginTop: 6 }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** For FlatLists drawn as one grouped section: round only the first and last rows. */
export function groupedItem(palette: Palette, index: number, count: number, inset = space.gutter): ViewStyle {
  return {
    backgroundColor: palette.card,
    marginHorizontal: inset,
    overflow: "hidden",
    borderCurve: "continuous",
    borderTopLeftRadius: index === 0 ? 24 : 0,
    borderTopRightRadius: index === 0 ? 24 : 0,
    borderBottomLeftRadius: index === count - 1 ? 24 : 0,
    borderBottomRightRadius: index === count - 1 ? 24 : 0,
  };
}

/** The hairline between grouped FlatList rows. */
export function GroupSeparator({ inset = space.gutter, indent = 60 }: { inset?: number; indent?: number }) {
  const palette = usePalette();
  return (
    <View style={{ backgroundColor: palette.card, marginHorizontal: inset }}>
      <View style={{ marginLeft: indent, height: StyleSheet.hairlineWidth, backgroundColor: palette.separator }} />
    </View>
  );
}
