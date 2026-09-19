import Link from "next/link";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, contracts } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { Heading, Empty, Badge } from "@/components/ui";
import { dateLabel } from "@/lib/format";
export default async function Contracts() {
  const actor = await getActor();
  const ids = allowedIds(actor, "finance");
  const rows = await db
    .select({ contract: contracts, company: companies.name })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .where(
      actor.admin
        ? sql`true`
        : ids.length
          ? and(
              inArray(contracts.companyId, ids),
              isNotNull(contracts.publishedAt),
            )
          : sql`false`,
    )
    .orderBy(desc(contracts.updatedAt))
    .limit(200);
  return (
    <>
      <Heading
        title="Contratos"
        description={
          actor.admin
            ? "Escreva, revise e publique contratos para cada cliente."
            : "Consulte os contratos da sua empresa e baixe em PDF."
        }
        action={
          actor.admin
            ? { label: "Criar contrato", href: "/contratos/novo" }
            : undefined
        }
      />
      <section className="panel">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Cliente</th>
                  <th>Situação</th>
                  <th>Atualização</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ contract: c, company }) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contratos/${c.id}`}>
                        {actor.admin ? c.title : c.publication?.title}
                      </Link>
                    </td>
                    <td>{company}</td>
                    <td>
                      <Badge status={c.publishedAt ? "active" : "draft"}>
                        {c.publishedAt ? "Publicado" : "Rascunho"}
                      </Badge>
                    </td>
                    <td>
                      {dateLabel(actor.admin ? c.updatedAt : c.publishedAt!)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum contrato disponível"
            description={
              actor.admin
                ? "Crie um rascunho e publique quando estiver pronto."
                : "Os contratos publicados para sua empresa aparecerão aqui."
            }
          />
        )}
      </section>
      {rows.length === 200 && (
        <p className="muted">Exibindo os 200 contratos mais recentes.</p>
      )}
    </>
  );
}
