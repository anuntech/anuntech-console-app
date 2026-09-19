import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tickets, companies } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { Heading, Empty, Badge } from "@/components/ui";
import { ticketLabels, dateLabel } from "@/lib/format";
export default async function Tickets() {
  const actor = await getActor();
  const ids = allowedIds(actor, "support");
  const rows = await db
    .select({ ticket: tickets, company: companies.name })
    .from(tickets)
    .innerJoin(companies, eq(companies.id, tickets.companyId))
    .where(
      actor.admin
        ? sql`true`
        : ids.length
          ? inArray(tickets.companyId, ids)
          : sql`false`,
    )
    .orderBy(desc(tickets.updatedAt))
    .limit(200);
  return (
    <>
      <Heading
        eyebrow="ATENDIMENTO"
        title="Chamados"
        description="Converse com a equipe e acompanhe suas solicitações."
        action={
          actor.admin || ids.length
            ? { label: "Abrir chamado", href: "/chamados/novo" }
            : undefined
        }
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Solicitações</h2>
            <p>Consulte a situação e retome cada conversa.</p>
          </div>
          <span className="collection-count">
            {rows.length}
            {rows.length === 200 ? "+" : ""}{" "}
            {rows.length === 1 ? "chamado" : "chamados"}
          </span>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">
                Chamados das empresas com acesso autorizado
              </caption>
              <thead>
                <tr>
                  <th>Assunto</th>
                  <th>Empresa</th>
                  <th>Situação</th>
                  <th>Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ ticket: t, company }) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/chamados/${t.id}`}>{t.subject}</Link>
                      {t.priority === "high" && (
                        <small className="high-priority">Prioridade alta</small>
                      )}
                    </td>
                    <td>{company}</td>
                    <td>
                      <Badge status={t.status}>{ticketLabels[t.status]}</Badge>
                    </td>
                    <td>{dateLabel(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum chamado encontrado"
            description="Os chamados das empresas às quais você tem acesso aparecerão aqui."
          />
        )}
      </section>
      {rows.length === 200 && (
        <p className="muted">
          Exibindo os 200 chamados atualizados mais recentemente.
        </p>
      )}
    </>
  );
}
