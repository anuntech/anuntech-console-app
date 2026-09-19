import { Download, FileText, Globe2, PencilLine } from "lucide-react";
import styles from "../../empresas/management.module.css";
import { DownloadLink } from "@/components/download-link";
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
        eyebrow="DOCUMENTOS"
        title={actor.admin ? c.title : published!.title}
        description={row.company}
      />
      <div className={styles.documentLayout}>
        <section
          className={`panel ${styles.documentTop}`}
          aria-label="Situação e downloads do contrato"
        >
          <div>
            <Badge status={published ? "active" : "draft"}>
              {published
                ? `Publicado · versão ${c.publishedVersion}`
                : "Rascunho"}
            </Badge>
            <p>
              {published
                ? `Publicado em ${dateLabel(c.publishedAt!)}`
                : "Visível somente para a administração"}
            </p>
          </div>
          <div className={styles.documentActions}>
            {published && (
              <DownloadLink
                className="button primary"
                href={`/api/contratos/${id}/pdf`}
              >
                <Download size={16} />
                Baixar PDF
              </DownloadLink>
            )}
            {actor.admin && (
              <DownloadLink
                className="button"
                href={`/api/contratos/${id}/pdf?draft=1`}
              >
                <FileText size={16} />
                Baixar PDF do rascunho
              </DownloadLink>
            )}
          </div>
        </section>
        {actor.admin && (
          <div className={styles.formShell}>
            <section className={`panel ${styles.formCard}`}>
              <div className={styles.sectionHeader}>
                <PencilLine size={19} />
                <div>
                  <h2>Editar rascunho</h2>
                  <p>
                    Salvar mantém a versão do cliente. Publique quando a revisão
                    estiver concluída.
                  </p>
                </div>
              </div>
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
            <section className={`panel ${styles.publication}`}>
              <span className={styles.helpIcon}>
                <Globe2 size={19} />
              </span>
              <div className={styles.publicationHeading}>
                <h2>Disponibilidade para o cliente</h2>
                <p className="muted">
                  {changed
                    ? "Há um rascunho que ainda não foi publicado."
                    : "O texto salvo está igual à versão publicada."}
                </p>
              </div>
              {changed && (
                <ActionForm
                  key={`publish-${c.revision}`}
                  action={publishContract}
                  label="Publicar para o cliente"
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
                      Quero interromper a visualização e o download deste
                      contrato pelo cliente.
                    </label>
                  </ActionForm>
                </details>
              )}
            </section>
          </div>
        )}
        {published && (
          <article className={`panel ${styles.documentPaper}`}>
            <p className="eyebrow">VERSÃO PUBLICADA · {c.publishedVersion}</p>
            <h2>{published.title}</h2>
            <p className="muted">
              {published.companyName} · {published.companyDocument}
            </p>
            <div className="contract-body">{published.body}</div>
          </article>
        )}
      </div>
    </>
  );
}
