import { View } from "react-native";
import { SymbolView } from "@/components/symbol";
import { haptic } from "@/lib/haptics";
import type { MemberScope, ScopeChoice } from "@/lib/manager";
import { space, usePalette } from "@/lib/theme";
import { Button } from "./button";
import { ListRow } from "./list-row";
import { Section } from "./section";
import { Text } from "./text";

/** The trailing check of a chosen row (never color alone). */
export function Check({ on = true }: { on?: boolean }) {
  const palette = usePalette();
  if (!on) return <View style={{ width: 17 }} />;
  return <SymbolView name="checkmark" size={17} weight="semibold" tintColor={palette.primary} accessible={false} />;
}

/**
 * "O que esta pessoa vê", as the web's EngagementScopeField: everything of the
 * company, or only the products, services and projects ticked here. The
 * server checks every id belongs to the company.
 */
export function ScopePicker({
  value,
  onChange,
  choices,
  header = "O que esta pessoa vê",
}: {
  value: MemberScope;
  onChange: (scope: MemberScope) => void;
  choices: ScopeChoice[];
  header?: string;
}) {
  const chosen = new Set(value.ids);
  const pick = (next: MemberScope) => {
    haptic.select();
    onChange(next);
  };
  const toggle = (id: string) =>
    pick({ access: "selected", ids: chosen.has(id) ? value.ids.filter((x) => x !== id) : [...value.ids, id] });
  const all = value.access === "all";
  const count = choices.filter((c) => chosen.has(c.id)).length;
  return (
    <View style={{ gap: space.md }}>
      <Section header={header} indent={space.lg}>
        <ListRow
          title="Tudo da empresa"
          subtitle="Produtos, serviços e projetos, também os que entrarem depois."
          trailing={<Check on={all} />}
          accessibilityRole="radio"
          accessibilityState={{ checked: all }}
          testID="scope-all"
          onPress={() => pick({ access: "all", ids: [] })}
        />
        <ListRow
          title="Só o que eu escolher"
          subtitle="Os outros itens e os chamados sobre eles ficam fora da visão dela."
          trailing={<Check on={!all} />}
          accessibilityRole="radio"
          accessibilityState={{ checked: !all }}
          testID="scope-selected"
          onPress={() => pick({ access: "selected", ids: all ? [] : value.ids })}
        />
      </Section>
      {!all &&
        (choices.length ? (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginHorizontal: space.lg }}>
              <Text variant="caption" tone="muted" style={{ flex: 1 }} accessibilityLiveRegion="polite">
                {count} de {choices.length} {choices.length === 1 ? "escolhido" : "escolhidos"}
              </Text>
              <Button
                title="Marcar todos"
                variant="plain"
                size="small"
                onPress={() => pick({ access: "selected", ids: choices.map((c) => c.id) })}
              />
              <Button title="Limpar" variant="plain" size="small" onPress={() => pick({ access: "selected", ids: [] })} />
            </View>
            <Section indent={space.lg}>
              {choices.map((choice) => (
                <ListRow
                  key={choice.id}
                  title={choice.name}
                  subtitle={choice.kindLabel}
                  trailing={<Check on={chosen.has(choice.id)} />}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: chosen.has(choice.id) }}
                  onPress={() => toggle(choice.id)}
                />
              ))}
            </Section>
            <Text variant="caption" tone={count ? "muted" : "warning"} style={{ marginHorizontal: space.lg }}>
              {count
                ? "Itens novos só aparecem para esta pessoa quando você marcar aqui. Chamados sem produto e Arquivos continuam visíveis, menos as entregas dos projetos não marcados."
                : "Sem nada marcado, a pessoa só vê chamados sem produto e Arquivos (sem as entregas de projetos)."}
            </Text>
          </View>
        ) : (
          <Text variant="caption" tone="muted" style={{ marginHorizontal: space.lg }}>
            A empresa ainda não tem produtos, serviços ou projetos para escolher.
          </Text>
        ))}
    </View>
  );
}
