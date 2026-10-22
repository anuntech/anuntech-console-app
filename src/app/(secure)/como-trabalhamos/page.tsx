import type { Metadata } from "next";
import { getActor } from "@/lib/access/access";
import { guideSections } from "@/lib/guide/guide-content";
import { guideTermsFor } from "@/lib/guide/guide-terms";
import { GuideView } from "@/components/guide/guide-view";

export const metadata: Metadata = {
  title: "Como trabalhamos",
  description: "Como a Anuntech atende: chamados, prazos, projetos e contratação.",
};

export default async function HowWeWork() {
  const actor = await getActor();
  // Each of the client's companies with the conditions it has published; the team reads the page as clients do.
  const terms = await guideTermsFor(actor);
  return <GuideView sections={guideSections} terms={terms} staff={actor.admin} />;
}
