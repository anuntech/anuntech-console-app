import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { engagements } from "@/db/schema";
import { getActor } from "@/lib/access";

/** Old links: a project moved to /projetos, a product lives on the list. */
export default async function Engagement({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await getActor();
  const { id } = await params;
  const [row] = await db
    .select({ kind: engagements.kind })
    .from(engagements)
    .where(eq(engagements.id, id));
  redirect(row?.kind === "project" ? `/projetos/${id}` : "/produtos");
}
