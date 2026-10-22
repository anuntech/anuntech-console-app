import type { ReactNode } from "react";
import { SymbolView } from "expo-symbols";
import { haptic } from "@/lib/haptics";
import { usePalette } from "@/lib/theme";
import { Button } from "./button";
import { ListRow } from "./list-row";
import { Section } from "./section";
import { Sheet } from "./sheet";

export type PickOption = { value: string; label: string; leading?: ReactNode; hint?: string };

/** The trailing check of a chosen row (never color alone). */
export function Check() {
  const palette = usePalette();
  return <SymbolView name="checkmark" size={17} weight="semibold" tintColor={palette.primary} accessible={false} />;
}

/**
 * Choosing from a list in a sheet: one value (it closes on the tap) or
 * several (each tap toggles, "Pronto" closes). Used by the board's filters and
 * the task's people and column.
 */
export function PickSheet({
  visible,
  onClose,
  title,
  subtitle,
  options,
  selected,
  onChange,
  multiple = false,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: PickOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  footer?: string;
}) {
  const toggle = (value: string) => {
    haptic.select();
    if (!multiple) {
      onChange([value]);
      onClose();
      return;
    }
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <Section indent={options.some((o) => o.leading) ? 60 : 16} footer={footer}>
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <ListRow
              key={option.value}
              leading={option.leading}
              title={option.label}
              subtitle={option.hint}
              trailing={on ? <Check /> : "none"}
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityState={multiple ? { checked: on } : { selected: on }}
              accessibilityLabel={[option.label, option.hint].filter(Boolean).join(", ")}
              onPress={() => toggle(option.value)}
            />
          );
        })}
      </Section>
      {multiple ? <Button title="Pronto" variant="secondary" onPress={onClose} /> : null}
    </Sheet>
  );
}
