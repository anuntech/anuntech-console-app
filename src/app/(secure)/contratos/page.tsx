import { ArrowRight, FileText } from "lucide-react";
import styles from "../empresas/management.module.css";
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
        eyebrow="DOCUMENTOS"
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
        <div className={styles.toolbar}>
          <div>
            <div className={styles.toolbarTitle}>
              <h2>
                {actor.admin ? "Todos os contratos" : "Contratos publicados"}
              </h2>
              <span className={styles.count}>{rows.length}</span>
            </div>
            <p>
              {actor.admin
                ? "Gerencie os rascunhos e as versões disponíveis para os clientes."
                : "Versões disponíveis para consulta e download."}
            </p>
          </div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">
                Contratos e situação de publicação
              </caption>
              <thead>
                <tr>
                  <th scope="col">Contrato</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Atualização</th>
                  <th scope="col">
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ contract: c, company }) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        className={styles.entity}
                        href={`/contratos/${c.id}`}
                      >
                        <span className={styles.avatar}>
                          <FileText size={17} />
                        </span>
                        <span>
                          {actor.admin ? c.title : c.publication?.title}
                          {c.publishedAt && (
                            <small>Versão {c.publishedVersion}</small>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className={styles.cellMuted}>{company}</td>
                    <td>
                      <Badge status={c.publishedAt ? "active" : "draft"}>
                        {c.publishedAt ? "Publicado" : "Rascunho"}
                      </Badge>
                    </td>
                    <td className={styles.cellMuted}>
                      {dateLabel(actor.admin ? c.updatedAt : c.publishedAt!)}
                    </td>
                    <td>
                      <Link
                        className={styles.rowAction}
                        href={`/contratos/${c.id}`}
                        aria-label={`Abrir contrato ${actor.admin ? c.title : c.publication?.title}`}
                      >
                        Abrir
                        <ArrowRight size={15} />
                      </Link>
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
        {rows.length > 0 && (
          <p className={styles.listFooter}>
            {rows.length === 200
              ? "Exibindo os 200 contratos mais recentes."
              : `${rows.length} ${rows.length === 1 ? "contrato disponível" : "contratos disponíveis"}`}
          </p>
        )}
      </section>
    </>
  );
}
