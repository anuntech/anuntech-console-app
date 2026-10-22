import { SettingsShell } from "@/components/settings/settings-shell";
import { CatalogSection } from "@/components/settings/catalog-section";
import { NewCatalogItemButton } from "@/components/settings/catalog-table";
export const metadata = { title: "Catálogo" };
export default function Page() {
  return (
    <SettingsShell
      section="catalog"
      title="Catálogo"
      description="Cada item é vinculado a um cliente em Produtos e serviços."
      actions={<NewCatalogItemButton />}
    >
      <CatalogSection />
    </SettingsShell>
  );
}
