import { SettingsShell } from "@/components/settings/settings-shell";
import { CatalogSection } from "@/components/settings/catalog-section";
import { NewCatalogItemButton } from "@/components/settings/catalog-table";
export const metadata = { title: "Catálogo" };
export default function Page() {
  return (
    <SettingsShell
      section="catalog"
      title="Catálogo"
      description="Os produtos e serviços da Anuntech. Vincule cada um a um cliente em Produtos e serviços."
      actions={<NewCatalogItemButton />}
    >
      <CatalogSection />
    </SettingsShell>
  );
}
