import { SettingsShell } from "@/components/settings/settings-shell";
import { CleanupList } from "@/components/settings/cleanup-list";
import { requireAdmin } from "@/lib/access/access";
import { cleanupCandidates } from "@/lib/companies/cleanup";
export const metadata = { title: "Limpeza" };
export default async function Page() {
  await requireAdmin();
  return (
    <SettingsShell
      section="cleanup"
      title="Limpeza"
      description="Registros com cara de teste. A exclusão segue as regras de sempre, na página de cada um."
    >
      <CleanupList items={await cleanupCandidates()} />
    </SettingsShell>
  );
}
