import { Boxes, Building2, FolderKanban, Package } from "lucide-react";
import styles from "../empresas/management.module.css";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { engagements, companies } from "@/db/schema";
import { getActor } from "@/lib/access";
import { updateEngagement } from "@/lib/actions";
import { engagementLabels } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Heading, Empty, Badge } from "@/components/ui";
export default async function Products() {
  const actor = await getActor();
  const rows = await db
    .select({ item: engagements, company: companies.name })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .where(
      actor.admin
        ? sql`true`
        : actor.grants.length
          ? inArray(
              engagements.companyId,
              actor.grants.map((g) => g.company.id),
            )
          : sql`false`,
    )
    .orderBy(engagements.name);
  return (
    <>
      <Heading
        eyebrow="RELACIONAMENTO"
        title="Produtos e projetos"
        description={
          actor.admin
            ? "Acompanhe os produtos e projetos de cada cliente em um só lugar."
            : "Veja o que sua empresa está construindo com a Anuntech."
        }
        action={
          actor.admin
            ? { label: "Adicionar", href: "/produtos/novo" }
            : undefined
        }
      />
      {rows.length ? (
        <>
          <div
            className={styles.productSummary}
            aria-label="Resumo dos vínculos"
          >
            <span>
              <Boxes size={15} />
              {rows.length} {rows.length === 1 ? "vínculo" : "vínculos"}
            </span>
            <span>
              <Package size={15} />
              {rows.filter(({ item }) => item.kind === "product").length}{" "}
              produtos
            </span>
            <span>
              <FolderKanban size={15} />
              {rows.filter(({ item }) => item.kind !== "product").length}{" "}
              projetos
            </span>
          </div>
          <div className="card-grid">
            {rows.map(({ item, company }) => (
              <article className={`panel ${styles.productCard}`} key={item.id}>
                <div className="card-top">
                  <span className={styles.avatar}>
                    {item.kind === "product" ? (
                      <Package size={19} />
                    ) : (
                      <FolderKanban size={19} />
                    )}
                  </span>
                  <Badge status={item.status}>
                    {engagementLabels[item.status]}
                  </Badge>
                </div>
                <h2>{item.name}</h2>
                <p className={styles.productCompany}>
                  <Building2 size={14} />
                  {company}
                  <span aria-hidden="true">·</span>
                  {item.kind === "product" ? "Produto" : "Projeto"}
                </p>
                <p
                  className={`${styles.productDescription}${item.description ? "" : " muted"}`}
                >
                  {item.description || "Nenhuma descrição adicionada."}
                </p>
                {actor.admin && (
                  <ActionForm
                    action={updateEngagement}
                    label="Atualizar"
                    className="inline-form"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <label className="sr-only" htmlFor={`status-${item.id}`}>
                      Situação de {item.name}
                    </label>
                    <select
                      id={`status-${item.id}`}
                      name="status"
                      defaultValue={item.status}
                    >
                      <option value="active">Ativo</option>
                      <option value="paused">Pausado</option>
                      <option value="completed">Concluído</option>
                    </select>
                  </ActionForm>
                )}
              </article>
            ))}
          </div>
        </>
      ) : (
        <section className="panel">
          <Empty
            title="Nenhum produto ou projeto cadastrado"
            description="Os vínculos com a Anuntech aparecerão aqui."
          />
        </section>
      )}
    </>
  );
}
