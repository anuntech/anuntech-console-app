import Link from "next/link";
import { paymentUrl } from "@/lib/payment-link";
import { Notification } from "@/components/notifications";
import CrudInvoiceManager from "@/components/crud-invoice-manager";
import { saoPauloDate } from "@/lib/dates";
import { and, desc, eq, inArray, sql, ilike, or, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, companies, subscriptions } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { Heading } from "@/components/ui";
import { invoiceQuery, type InvoiceStatusFilter } from "@/lib/invoice-table";
export default async function Finance({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = invoiceQuery(await searchParams);
  const today = saoPauloDate();
  const actor = await getActor();
  const ids = allowedIds(actor, "finance");
  const access = actor.admin
    ? sql`true`
    : ids.length
      ? and(
          inArray(invoices.companyId, ids),
          inArray(invoices.status, ["issued", "paid"]),
        )
      : sql`false`;
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const scope = and(
    access,
    search
      ? or(
          ilike(invoices.description, `%${search}%`),
          ilike(companies.name, `%${search}%`),
        )
      : undefined,
  );
  const displayStatus = sql<string>`case when ${invoices.status} = 'draft' and ${subscriptions.status} = 'active' then 'scheduled' when ${invoices.status} = 'issued' and ${invoices.dueDate} < ${today} then 'overdue' else ${invoices.status} end`;
  const grouped = await db
    .select({ status: displayStatus, count: count() })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .leftJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
    .where(scope)
    .groupBy(sql`1`);
  const counts: Record<InvoiceStatusFilter, number> = {
    all: 0,
    issued: 0,
    overdue: 0,
    paid: 0,
    scheduled: 0,
    draft: 0,
    cancelled: 0,
  };
  for (const row of grouped) {
    counts[row.status as InvoiceStatusFilter] = row.count;
    counts.all += row.count;
  }
  const total = counts[query.status];
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const rows = await db
    .select({
      invoice: {
        id: invoices.id,
        subscriptionId: invoices.subscriptionId,
        publicId: invoices.publicId,
        publicEnabled: invoices.publicEnabled,
        description: invoices.description,
        amountCents: invoices.amountCents,
        status: invoices.status,
        dueDate: invoices.dueDate,
        createdAt: invoices.createdAt,
      },
      company: companies.name,
      subscriptionStatus: subscriptions.status,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .leftJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
    .where(
      and(
        scope,
        query.status !== "all"
          ? sql`${displayStatus} = ${query.status}`
          : undefined,
      ),
    )
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    .limit(query.pageSize)
    .offset((page - 1) * query.pageSize);
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
          message="Crie uma cobrança única ou recorrente. Publique para ativar a cobrança e os avisos por e-mail e WhatsApp."
          id="finance-info"
        />
      )}
      {actor.admin && (
        <p>
          <Link className="button secondary" href="/financeiro/envios">
            Acompanhar entrega de e-mails e WhatsApp
          </Link>
        </p>
      )}
      <CrudInvoiceManager
        admin={actor.admin}
        today={today}
        query={{ ...query, page }}
        counts={counts}
        total={total}
        pageCount={pageCount}
        invoices={rows.map(({ invoice, company, subscriptionStatus }) => ({
          id: invoice.id,
          recurring: !!invoice.subscriptionId,
          scheduled:
            invoice.status === "draft" && subscriptionStatus === "active",
          publicUrl:
            invoice.publicId &&
            invoice.publicEnabled &&
            ["issued", "paid"].includes(invoice.status)
              ? paymentUrl(invoice.publicId)
              : undefined,
          description: invoice.description,
          company,
          amountCents: invoice.amountCents,
          status: invoice.status,
          dueDate: invoice.dueDate,
          createdDate: saoPauloDate(invoice.createdAt),
        }))}
      />
    </>
  );
}
