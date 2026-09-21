import { eq } from "drizzle-orm";
import { tickets, invoices, contracts } from "@/db/schema";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { getActor, accessibleCompanies } from "@/lib/access";
import { NewTicketModal } from "./new-ticket-modal";
export async function NewTicketPage({
  searchParams,
  intercepted = false,
}: {
  searchParams: Promise<{ companyId?: string; from?: string }>;
  intercepted?: boolean;
}) {
  const actor = await getActor();
  const available = [...new Map((await accessibleCompanies(actor, "support")).map(company => [company.id, company])).values()];
  const query = await searchParams;
  let companyId = query.companyId;
  const context = query.from?.match(
    /^\/(empresas|chamados|financeiro|contratos)\/([a-f0-9-]{36})(?:\/|$)/,
  );
  if (actor.admin && !companyId && context) {
    const [, area, id] = context;
    if (area === "empresas") companyId = id;
    else {
      const table =
        area === "chamados"
          ? tickets
          : area === "financeiro"
            ? invoices
            : contracts;
      const [row] = await db
        .select({ companyId: table.companyId })
        .from(table)
        .where(eq(table.id, id));
      companyId = row?.companyId;
    }
  }
  const company = actor.admin
    ? available.find((c) => c.id === companyId)
    : available.length === 1
      ? available[0]
      : available.find((c) => c.id === companyId);
  if (companyId && company?.id !== companyId) notFound();
  if (!actor.admin && !available.length) notFound();
  return (
    <NewTicketModal
      company={company ? { id: company.id, name: company.name } : null}
      intercepted={intercepted}
    />
  );
}
