import "server-only";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { contracts, invoices, tickets } from "@/db/schema";
import { db } from "@/lib/db";
import { accessibleCompanies, getActor } from "@/lib/access/access";
import type { TicketCompanyOption } from "./ticket-form";

export type NewTicketSearchParams = Promise<{
  companyId?: string;
  from?: string;
}>;

/**
 * Which companies the viewer may open a ticket for, and which one is
 * preselected: `companyId`, else (staff only) the company behind the page
 * they came from, else the only company they have. A forged `companyId`
 * answers 404.
 */
export async function newTicketContext(
  searchParams: NewTicketSearchParams,
): Promise<{ companies: TicketCompanyOption[]; companyId?: string }> {
  const actor = await getActor();
  const available = [
    ...new Map(
      (await accessibleCompanies(actor, "support")).map((c) => [c.id, c]),
    ).values(),
  ];
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
  if (companyId && !available.some((c) => c.id === companyId)) notFound();
  if (!actor.admin && !available.length) notFound();
  // Archived clients stay out of the picker unless asked for by id.
  const companies = available
    .filter((c) => !c.archived || c.id === companyId)
    .map((c) => ({ id: c.id, name: c.name, document: c.document }));
  return {
    companies,
    companyId:
      companyId ?? (companies.length === 1 ? companies[0].id : undefined),
  };
}
