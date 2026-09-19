import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, companies } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { Heading, Empty, Badge } from "@/components/ui";
import { invoiceLabels, currency, dateLabel } from "@/lib/format";
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
        <p className="alert">
          Crie um rascunho e abra a fatura para emitir manualmente no Inter.
          Consulte a cobrança para atualizar o pagamento. Emissão fiscal aguarda
          configuração.
        </p>
      )}
      <section className="panel">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Empresa</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ invoice: i, company }) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/financeiro/${i.id}`}>{i.description}</Link>
                    </td>
                    <td>{company}</td>
                    <td className="nowrap">{currency(i.amountCents)}</td>
                    <td>{dateLabel(i.dueDate)}</td>
                    <td>
                      <Badge status={i.status}>{invoiceLabels[i.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma fatura disponível"
            description={
              actor.admin
                ? "Crie uma fatura para preparar a cobrança do cliente."
                : "As cobranças emitidas para sua empresa aparecerão aqui."
            }
          />
        )}
      </section>
      {rows.length === 200 && (
        <p className="muted">Exibindo as 200 faturas mais recentes.</p>
      )}
    </>
  );
}
