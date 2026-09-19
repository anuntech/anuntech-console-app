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
        description="Veja o que sua empresa está construindo com a Anuntech."
        action={
          actor.admin
            ? { label: "Adicionar", href: "/produtos/novo" }
            : undefined
        }
      />
      {rows.length ? (
        <div className="card-grid">
          {rows.map(({ item, company }) => (
            <article className="panel padded" key={item.id}>
              <div className="card-top">
                <span className="eyebrow">
                  {item.kind === "product" ? "PRODUTO" : "PROJETO"}
                </span>
                <Badge status={item.status}>
                  {engagementLabels[item.status]}
                </Badge>
              </div>
              <h2>{item.name}</h2>
              <p className="muted">{company}</p>
              {item.description && (
                <p className="pre-wrap">{item.description}</p>
              )}
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
