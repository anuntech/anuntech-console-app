import type { Metadata } from "next";
import { allowedIds, getActor } from "@/lib/access/access";
import { HelpHub } from "@/components/help/help-hub";

export const metadata: Metadata = {
  title: "Ajuda",
  description: "Tudo o que dá para fazer no Console, passo a passo, com as regras e os tutoriais em vídeo.",
};

export default async function Help({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const actor = await getActor();
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.slice(0, 160) ?? "";
  // The header lives in the hub's hero, beside the search and the illustration.
  return (
    <HelpHub
      query={query}
      viewer={{
        staff: actor.admin,
        manager: allowedIds(actor, "finance").length > 0,
        support: allowedIds(actor, "support").length > 0,
      }}
    />
  );
}
