import { Notification } from "@/components/notifications";
import CrudInvoiceManager from "@/components/crud-invoice-manager";
import { saoPauloDate } from "@/lib/dates";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, companies } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { Heading } from "@/components/ui";
export default async function Finance() {
  const actor = await getActor();
  const ids = allowedIds(actor, "finance");
  const rows = await db
    .select({ invoice: invoices, company: companies.name })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .where(
      actor.admin
        ? sql`true`
        : ids.length
          ? and(
              inArray(invoices.companyId, ids),
              inArray(invoices.status, ["issued", "paid"]),
            )
          : sql`false`,
    )
    .orderBy(desc(invoices.createdAt))
    .limit(200);
  return (
    <>
      <Heading
        eyebrow="FINANCEIRO"
        title="Faturas"
        description={
          actor.admin
            ? "Crie e acompanhe as faturas de cada cliente."
            : "Consulte as cobranças e os documentos da sua empresa."
        }
        action={
          actor.admin
            ? { label: "Criar fatura", href: "/financeiro/nova" }
            : undefined
        }
      />
      {actor.admin && (
        <Notification
          message="Crie um rascunho e abra a fatura para emitir manualmente no Inter. Consulte a cobrança para atualizar o pagamento. Emissão fiscal aguarda configuração."
          id="finance-info"
        />
      )}
      <CrudInvoiceManager
        admin={actor.admin}
        today={saoPauloDate()}
        invoices={rows.map(({ invoice, company }) => ({
          id: invoice.id,
          description: invoice.description,
          company,
          amountCents: invoice.amountCents,
          status: invoice.status,
          dueDate: invoice.dueDate,
          createdDate: saoPauloDate(invoice.createdAt),
        }))}
      />
      {rows.length === 200 && (
        <p className="muted">Exibindo as 200 faturas mais recentes.</p>
      )}
    </>
  );
}
