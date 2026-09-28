import { requireAdmin } from "@/lib/access/access";
import { NewCompanySheet } from "@/components/empresas/company-sheet";
export const metadata = { title: "Nova empresa" };
export default async function Page() {
  await requireAdmin();
  return <NewCompanySheet />;
}
