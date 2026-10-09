import { requireAdmin } from "@/lib/access/access";
import { NewJourneySheet } from "@/components/jornadas/new-journey";
import { newJourneyContext } from "@/components/jornadas/new-journey-context";
export const metadata = { title: "Nova jornada" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireAdmin();
  return <NewJourneySheet context={await newJourneyContext(await searchParams, actor.user.id)} />;
}
