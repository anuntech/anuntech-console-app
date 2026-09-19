import Link from "next/link";
import { db } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { companies, companyInvites } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { Heading, Empty } from "@/components/ui";
export default async function Companies({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const archived = (await searchParams).status === "arquivados";
  const rows = await db
    .select()
    .from(companies)
    .where(eq(companies.archived, archived))
    .orderBy(companies.name);
  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(companyInvites)
    .where(eq(companyInvites.status, "submitted"));
  return (
    <>
      <Heading
        eyebrow="CLIENTES"
        title="Empresas"
        description="Organize os clientes e as pessoas que têm acesso à Console."
        action={{ label: "Cadastrar empresa", href: "/empresas/nova" }}
      />
      <p>
        <Link className="button" href="/empresas/convites">
          Links e cadastros recebidos
          {pending > 0 ? ` (${pending} para revisar)` : ""}
        </Link>
      </p>
      <nav
        className="member-actions section-gap"
        aria-label="Situação dos clientes"
      >
        <Link
          className={`button${!archived ? " primary" : ""}`}
          href="/empresas"
          aria-current={!archived ? "page" : undefined}
        >
          Ativos
        </Link>
        <Link
          className={`button${archived ? " primary" : ""}`}
          href="/empresas?status=arquivados"
          aria-current={archived ? "page" : undefined}
        >
          Arquivados
        </Link>
      </nav>
      <section className="panel">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>CPF / CNPJ</th>
                  <th>E-mail financeiro</th>
                  <th>
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/empresas/${c.id}`}>{c.name}</Link>
                    </td>
                    <td>{c.document}</td>
                    <td>{c.billingEmail}</td>
                    <td>
                      <Link href={`/empresas/${c.id}`}>Gerenciar →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              archived ? "Nenhum cliente arquivado" : "Nenhum cliente ativo"
            }
            description={
              archived
                ? "Os clientes que você arquivar ficarão disponíveis aqui para consulta e restauração."
                : "Cadastre uma empresa ou restaure um cliente da lista de arquivados."
            }
          />
        )}
      </section>
    </>
  );
}
