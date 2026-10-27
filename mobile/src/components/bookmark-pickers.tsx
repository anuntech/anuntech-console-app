import type { ReactNode } from "react";
import { SymbolView } from "@/components/symbol";
import { folderTree } from "@/lib/bookmark-text";
import type { BookmarkFolder } from "@/lib/bookmarks";
import { haptic } from "@/lib/haptics";
import { space, usePalette } from "@/lib/theme";
import { ListRow } from "./list-row";
import { Section } from "./section";
import { IconTile } from "./tile";

/** The trailing check of the chosen row (never color alone). */
export function Check() {
  const palette = usePalette();
  return <SymbolView name="checkmark" size={17} weight="semibold" tintColor={palette.primary} accessible={false} />;
}

/** One option of a picker section: the check, the selected state and a tick of haptics. */
function Option({ title, selected, hint, onPress, leading }: { title: string; selected: boolean; hint: string; onPress: () => void; leading?: ReactNode }) {
  return (
    <ListRow
      leading={leading}
      title={title}
      trailing={selected ? <Check /> : "none"}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? `${title}, selecionada` : title}
      accessibilityHint={hint}
      onPress={() => {
        haptic.select();
        onPress();
      }}
    />
  );
}

/** "Empresa", when the person has more than one. */
export function CompanyPicker({
  companies,
  value,
  onChange,
}: {
  companies: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (companies.length < 2) return null;
  return (
    <Section header="Empresa" inset={space.gutter} indent={space.lg}>
      {companies.map((c) => (
        <Option key={c.id} title={c.name} selected={value === c.id} hint="Empresa" onPress={() => onChange(c.id)} />
      ))}
    </Section>
  );
}

/** "Pasta": Sem pasta or a folder of the company the person can see (and so add to). */
export function FolderPicker({
  folders,
  value,
  onChange,
  header = "Pasta",
  showCompany = false,
}: {
  folders: BookmarkFolder[];
  value: string;
  onChange: (id: string) => void;
  header?: string;
  /** Folders of several companies (a copy): each says whose it is. */
  showCompany?: boolean;
}) {
  return (
    <Section header={header} inset={space.gutter}>
      <Option
        title="Sem pasta"
        selected={value === ""}
        hint="Pasta"
        leading={<IconTile icon="tray.fill" color="gray" />}
        onPress={() => onChange("")}
      />
      {folderTree(folders).map((f) => (
        <Option
          key={f.id}
          title={`${"— ".repeat(f.depth)}${f.name}${showCompany && f.company ? ` · ${f.company}` : ""}`}
          selected={value === f.id}
          hint="Pasta"
          leading={<IconTile icon={f.visibility === "people" ? "person.2.fill" : "folder.fill"} color={f.visibility === "people" ? "violet" : "teal"} />}
          onPress={() => onChange(f.id)}
        />
      ))}
    </Section>
  );
}
