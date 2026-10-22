import { View, type StyleProp, type ViewStyle } from "react-native";
import { space } from "@/lib/theme";
import { Text } from "./text";

/**
 * A contract's text as the Console writes it: paragraphs, with lines starting
 * with # as section titles and **bold** stripped to plain words. Selectable,
 * so the person can copy a clause.
 */
export function DocumentText({ body, style }: { body: string; style?: StyleProp<ViewStyle> }) {
  const blocks = body.replace(/\r/g, "").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <View style={[{ gap: space.md }, style]}>
      {blocks.map((block, index) => {
        const heading = block.match(/^#{1,6}\s+(.*)$/);
        const text = (heading ? heading[1] : block).replace(/\*\*(.+?)\*\*/g, "$1");
        return heading ? (
          <Text key={index} variant="heading" accessibilityRole="header" selectable style={index > 0 ? { marginTop: space.sm } : undefined}>
            {text}
          </Text>
        ) : (
          <Text key={index} selectable style={{ lineHeight: 26 }}>
            {text}
          </Text>
        );
      })}
    </View>
  );
}
