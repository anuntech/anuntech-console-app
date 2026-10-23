import { ScrollView } from "react-native";
import { Chip } from "@/components/chip";
import { space } from "@/lib/theme";

type Company = { id: string; name: string };

/**
 * The web's company filter (`?company=`) as chips: "Todas as empresas" and each
 * company, for a client with several. The company a link applied but that is
 * not among the choices (the team) shows alone, selected; tapping it clears it.
 */
export function CompanyChips({
  companies = [],
  filter,
  value,
  onChange,
}: {
  companies?: Company[];
  filter?: Company | null;
  value: string;
  onChange: (id: string) => void;
}) {
  const extra = value && filter?.id === value && !companies.some((c) => c.id === value) ? filter : null;
  if (companies.length < 2 && !extra) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Empresa"
      contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
    >
      {companies.length > 1 ? <Chip label="Todas as empresas" group="Empresas" selected={!value} onPress={() => onChange("")} /> : null}
      {companies.map((c) => (
        <Chip key={c.id} label={c.name} group="Empresas" selected={value === c.id} onPress={() => onChange(value === c.id ? "" : c.id)} />
      ))}
      {extra ? <Chip label={extra.name} group="Empresa. Toque para ver todas" selected onPress={() => onChange("")} /> : null}
    </ScrollView>
  );
}
