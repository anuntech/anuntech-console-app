import { ScrollView } from "react-native";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { ListRow } from "@/components/list-row";
import { Check } from "@/components/member-scope";
import { Section } from "@/components/section";
import { APPEARANCE_OPTIONS, setAppearance, useAppearanceChoice, type AppearanceChoice } from "@/lib/appearance";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { space, usePalette } from "@/lib/theme";

const icons: Record<AppearanceChoice, SFSymbol> = {
  light: "sun.max",
  dark: "moon",
  system: "circle.lefthalf.filled",
};

/** Configurações → Aparência on the web: Claro, Escuro or Sistema, kept on this phone. */
export default function AppearanceScreen() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const choice = useAppearanceChoice();
  const pick = (next: AppearanceChoice) => {
    if (next === choice) return;
    haptic.select();
    void setAppearance(next);
  };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
    >
      <Section header="Tema" footer="Vale só para este celular. Em Sistema, o app segue o modo claro ou escuro do celular.">
        {APPEARANCE_OPTIONS.map((option) => (
          <ListRow
            key={option.value}
            testID={`appearance-${option.value}`}
            title={option.label}
            leading={<SymbolView name={icons[option.value]} size={20} tintColor={palette.primary} accessible={false} style={{ width: 28 }} />}
            trailing={<Check on={choice === option.value} />}
            accessibilityRole="radio"
            accessibilityState={{ checked: choice === option.value }}
            onPress={() => pick(option.value)}
          />
        ))}
      </Section>
    </ScrollView>
  );
}
