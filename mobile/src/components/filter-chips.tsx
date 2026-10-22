import { ScrollView } from "react-native";
import { space } from "@/lib/theme";
import { Chip } from "./chip";

/** A list's situation filter as a row of chips that scrolls sideways (the web's "Situação" select). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  group,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** What the set is, read by VoiceOver: "Situação". */
  group: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // The list header sits inside the screen's margin; the chips scroll from edge to edge.
      style={{ marginHorizontal: -space.gutter }}
      contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
    >
      {options.map((option) => (
        <Chip key={option.value} label={option.label} group={group} selected={value === option.value} onPress={() => onChange(option.value)} />
      ))}
    </ScrollView>
  );
}
