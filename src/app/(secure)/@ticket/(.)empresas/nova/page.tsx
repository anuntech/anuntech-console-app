import { requireAdmin } from "@/lib/access/access";
import { NewCompanySheet } from "@/components/empresas/company-sheet";
export const metadata = { title: "Nova empresa" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { jornada } = await searchParams;
  return <NewCompanySheet journeyId={typeof jornada === "string" && /^[0-9a-f-]{36}$/.test(jornada) ? jornada : ""} />;
}
