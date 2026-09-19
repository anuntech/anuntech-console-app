import Link from "next/link";
import { db } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { companies, companyInvites } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { Heading, Empty } from "@/components/ui";
export default async function Companies() {
  await requireAdmin();
  const rows = await db.select().from(companies).orderBy(companies.name);
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
            title="Cadastre sua primeira empresa"
            description="Os clientes de produtos e projetos ficam organizados aqui."
          />
        )}
      </section>
    </>
  );
}
