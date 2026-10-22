"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "../access/access";
import { markGuideReadAs } from "./guide-terms";
import { markCompanyStep } from "./mark-step";

/** Reading "Como trabalhamos" counts once per version; it never stands for accepting any term. */
export async function markGuideRead() {
  await markGuideReadAs(await getActor());
  revalidatePath("/painel");
}

/** A first step done by hand, or the card hidden, for one company the person belongs to. */
export async function markFirstStep(companyId: string, key: string) {
  const actor = await getActor();
  if (!(await markCompanyStep(actor, companyId, key))) return;
  revalidatePath("/painel");
}
