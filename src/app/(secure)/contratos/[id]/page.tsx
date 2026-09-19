import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { companies, contracts } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import {
  saveContract,
  publishContract,
  unpublishContract,
} from "@/lib/contract-actions";
import { ActionForm } from "@/components/action-form";
import { Heading, Back, Field, Badge } from "@/components/ui";
import { dateLabel } from "@/lib/format";
export default async function Contract({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({ contract: contracts, company: companies.name })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .where(eq(contracts.id, id));
  if (
    !row ||
    !canAccess(actor, row.contract.companyId, "finance") ||
    (!actor.admin && !row.contract.publishedAt)
  )
    notFound();
  const c = row.contract,
    published = c.publishedAt ? c.publication : null;
  const changed =
    !published || published.title !== c.title || published.body !== c.body;
  return (
    <>
      <Back href="/contratos" label="Contratos" />
      <Heading
        title={actor.admin ? c.title : published!.title}
        description={row.company}
      />
      <div className="contract-toolbar">
        <Badge status={published ? "active" : "draft"}>
          {published ? `Publicado · versão ${c.publishedVersion}` : "Rascunho"}
        </Badge>
        {published && (
          <a className="button primary" href={`/api/contratos/${id}/pdf`}>
            Baixar PDF
          </a>
        )}
        {actor.admin && (
          <a className="button" href={`/api/contratos/${id}/pdf?draft=1`}>
            Baixar PDF do rascunho
          </a>
        )}
      </div>
      {actor.admin && (
        <>
          <section className="panel padded section-gap">
            <h2>Editar rascunho</h2>
            <p className="muted">
              Salvar não altera a versão do cliente. Revise o texto salvo e
              publique quando estiver pronto.
            </p>
            <ActionForm
              key={c.revision}
              action={saveContract}
              label="Salvar rascunho"
            >
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="revision" value={c.revision} />
              <Field label="Título">
                <input
                  name="title"
                  defaultValue={c.title}
                  maxLength={160}
                  required
                />
              </Field>
              <Field
                label="Texto do contrato"
                hint="Texto simples. As quebras de linha são preservadas na visualização e no PDF."
              >
                <textarea
                  name="body"
                  className="contract-editor"
                  rows={24}
                  maxLength={100000}
                  defaultValue={c.body}
                  required
                />
              </Field>
            </ActionForm>
          </section>
          <section className="panel padded section-gap">
            <h2>Disponibilidade para o cliente</h2>
            <p>
              {changed
                ? "Há um rascunho que ainda não foi publicado."
                : "O texto salvo está igual à versão publicada."}
            </p>
            {changed && (
              <ActionForm
                key={`publish-${c.revision}`}
                action={publishContract}
                label="Publicar para o cliente"
              >
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="revision" value={c.revision} />
                <label className="checkbox-field">
                  <input type="checkbox" name="confirm" value="yes" required />
                  Revisei o rascunho salvo e quero disponibilizá-lo para este
                  cliente.
                </label>
              </ActionForm>
            )}
            {published && (
              <details className="edit-details">
                <summary>Retirar da área do cliente</summary>
                <ActionForm
                  key={`unpublish-${c.revision}`}
                  action={unpublishContract}
                  label="Retirar publicação"
                  danger
                >
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="revision" value={c.revision} />
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      name="confirm"
                      value="yes"
                      required
                    />
                    Quero interromper a visualização e o download deste contrato
                    pelo cliente.
                  </label>
                </ActionForm>
              </details>
            )}
          </section>
        </>
      )}
      {published && (
        <article className="panel padded section-gap contract-document">
          <p className="muted">
            Publicado em {dateLabel(c.publishedAt!)} · versão{" "}
            {c.publishedVersion}
          </p>
          <h2>{published.title}</h2>
          <p className="muted">
            {published.companyName} · {published.companyDocument}
          </p>
          <div className="contract-body">{published.body}</div>
        </article>
      )}
    </>
  );
}
