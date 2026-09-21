import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Bookmark, ExternalLink, FileDown } from "lucide-react";
import { bookmarks, companies, engagements } from "@/db/schema";
import { db } from "@/lib/db";
import { getActor, accessibleCompanies } from "@/lib/access";
import { saveBookmark, deleteBookmark } from "@/lib/bookmark-actions";
import { ActionForm } from "@/components/action-form";
import { FormModal } from "@/components/form-modal";
import { CompanyPicker } from "@/components/company-picker";
import { Heading, Field, Empty } from "@/components/ui";
import styles from "./page.module.css";
export const metadata: Metadata = { title: "Bookmarks" };
export default async function Bookmarks({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; company?: string; page?: string }>;
}) {
  const actor = await getActor();
  const available = await accessibleCompanies(actor);
  const ids = available.map((c) => c.id);
  const { q = "", company = "", page = "1" } = await searchParams;
  const pageNumber = Math.min(
    100000,
    Math.max(1, Number.parseInt(page, 10) || 1),
  );
  const filters = [inArray(bookmarks.companyId, ids)];
  if (company) filters.push(eq(bookmarks.companyId, company));
  if (q.trim())
    filters.push(
      or(
        ilike(bookmarks.title, `%${q.trim().slice(0, 160)}%`),
        ilike(engagements.name, `%${q.trim().slice(0, 160)}%`),
      )!,
    );
  const rows = ids.length
    ? await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
          fileName: bookmarks.fileName,
          authorId: bookmarks.authorId,
          companyId: bookmarks.companyId,
          company: companies.name,
          project: engagements.name,
        })
        .from(bookmarks)
        .innerJoin(companies, eq(companies.id, bookmarks.companyId))
        .leftJoin(engagements, eq(engagements.id, bookmarks.engagementId))
        .where(and(...filters))
        .orderBy(desc(bookmarks.createdAt))
        .limit(24)
        .offset((pageNumber - 1) * 24)
    : [];
  const [{ total }] = ids.length
    ? await db
        .select({ total: count() })
        .from(bookmarks)
        .leftJoin(engagements, eq(engagements.id, bookmarks.engagementId))
        .where(and(...filters))
    : [{ total: 0 }];
  const pageHref = (next: number) =>
    `/bookmarks?${new URLSearchParams({ q, company, page: String(next) })}`;
  const projects = ids.length
    ? await db
        .select({
          id: engagements.id,
          name: engagements.name,
          companyId: engagements.companyId,
        })
        .from(engagements)
        .where(inArray(engagements.companyId, ids))
    : [];
  return (
    <>
      <Heading
        title="Bookmarks"
        description="Links e arquivos dos seus projetos."
      />
      <div className={styles.toolbar}>
        <form method="get" className={styles.filters}>
          <input
            aria-label="Buscar bookmarks"
            type="search"
            name="q"
            placeholder="Buscar por título ou projeto"
            defaultValue={q}
            maxLength={160}
          />
          {available.length > 1 && (
            <select
              aria-label="Filtrar por empresa"
              name="company"
              defaultValue={company}
            >
              <option value="">Todas as empresas</option>
              {available.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button className="button" type="submit">
            Buscar
          </button>
        </form>
        {ids.length > 0 && (
          <FormModal
            action={saveBookmark}
            trigger="Adicionar bookmark"
            title="Adicionar bookmark"
            description="Salve um link ou arquivo para a equipe da empresa."
            label="Salvar bookmark"
            triggerClassName="button primary"
            reset
          >
            {available.length === 1 ? (
              <>
                <input type="hidden" name="companyId" value={ids[0]} />
                <Field label="Projeto (opcional)">
                  <select name="engagementId" defaultValue="">
                    <option value="">Geral</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <CompanyPicker companies={available} engagements={projects} />
            )}
            <Field label="Título">
              <input
                name="title"
                required
                maxLength={160}
                placeholder="Ex.: Pasta de identidade visual"
              />
            </Field>
            <Field label="Link (opcional)">
              <input
                name="url"
                type="url"
                maxLength={2048}
                placeholder="https://"
              />
            </Field>
            <Field
              label="Arquivo (opcional)"
              hint="Até 1 MB. Para arquivos maiores, salve o link da pasta."
            >
              <input name="file" type="file" />
            </Field>
          </FormModal>
        )}
      </div>
      {rows.length ? (
        <div className={styles.grid}>
          {rows.map((item) => (
            <article className={styles.card} key={item.id}>
              <span className={styles.icon}>
                {item.url ? (
                  <Bookmark size={22} aria-hidden="true" />
                ) : (
                  <FileDown size={22} aria-hidden="true" />
                )}
              </span>
              <div>
                <h2>
                  <a
                    href={item.url || `/api/bookmarks/${item.id}`}
                    target={item.url ? "_blank" : undefined}
                    rel={item.url ? "noopener noreferrer" : undefined}
                  >
                    {item.title}
                    {item.url && (
                      <ExternalLink size={14} aria-label="Abre em nova aba" />
                    )}
                  </a>
                </h2>
                <p>
                  {item.company}
                  {item.project ? ` · ${item.project}` : ""}
                </p>
                <span className={styles.file}>
                  {item.fileName ||
                    (item.url ? new URL(item.url).hostname : "")}
                </span>
              </div>
              {(actor.admin ||
                item.authorId === actor.user.id ||
                actor.grants.some(
                  (g) =>
                    g.company.id === item.companyId && g.role === "manager",
                )) && (
                <ActionForm
                  action={deleteBookmark}
                  label="Remover"
                  submitAriaLabel={`Remover ${item.title}`}
                  danger
                  className={styles.remove}
                >
                  <input type="hidden" name="id" value={item.id} />
                </ActionForm>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Nenhum bookmark encontrado"
          description="Adicione links e arquivos para reunir os materiais dos projetos."
        />
      )}
      {total > 24 && (
        <nav className={styles.toolbar} aria-label="Paginação de bookmarks">
          {pageNumber > 1 && (
            <Link className="button" href={pageHref(pageNumber - 1)}>
              Anterior
            </Link>
          )}
          <span>
            Página {pageNumber} · {total} bookmarks
          </span>
          {pageNumber * 24 < total && (
            <Link className="button" href={pageHref(pageNumber + 1)}>
              Próxima
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
