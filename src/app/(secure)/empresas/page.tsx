import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Link2 } from "lucide-react";
import { db } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { companies, companyInvites } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { Heading, Empty, Badge } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { startAssistedSession } from "@/lib/assisted-actions";
import styles from "./management.module.css";
export const metadata: Metadata = {
  title: "Empresas",
  description:
    "Consulte os clientes e gerencie cadastros e acessos por empresa.",
};

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
        description="Cadastros, contatos financeiros e pessoas com acesso ao Console."
        action={{ label: "Cadastrar empresa", href: "/empresas/nova" }}
      />
      <section className="panel">
        <div className={styles.toolbar}>
          <nav className={styles.tabs} aria-label="Situação dos clientes">
            <Link
              href="/empresas"
              aria-current={!archived ? "page" : undefined}
            >
              Ativos
            </Link>
            <Link
              href="/empresas?status=arquivados"
              aria-current={archived ? "page" : undefined}
            >
              Arquivados
            </Link>
          </nav>
          <Link className="button" href="/empresas/convites">
            <Link2 size={16} aria-hidden="true" />
            Links e cadastros recebidos
            {pending > 0 && (
              <Badge status="pending">{pending} para revisar</Badge>
            )}
          </Link>
        </div>
        {rows.length ? (
          <>
            <div
              className="table-wrap"
              role="region"
              aria-label="Tabela de empresas"
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">
                  Empresas {archived ? "arquivadas" : "ativas"}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Empresa</th>
                    <th scope="col">CPF / CNPJ</th>
                    <th scope="col">E-mail financeiro</th>
                    <th scope="col">
                      <span className="sr-only">Ação</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          className={styles.entity}
                          href={`/empresas/${c.id}`}
                        >
                          <span className={styles.avatar}>
                            <Building2 size={17} aria-hidden="true" />
                          </span>
                          <span>{c.name}</span>
                        </Link>
                      </td>
                      <td className={styles.cellMuted}>{c.document}</td>
                      <td className={styles.cellMuted}>{c.billingEmail}</td>
                      <td>
                        <div className="member-actions">
                          <Link
                            className={styles.rowAction}
                            href={`/empresas/${c.id}`}
                            aria-label={`Gerenciar ${c.name}`}
                          >
                            Gerenciar{" "}
                            <ArrowRight size={15} aria-hidden="true" />
                          </Link>
                          <ActionForm
                            action={startAssistedSession}
                            className="compact-form"
                            label="Entrar como"
                            submitAriaLabel={`Entrar como ${c.name}`}
                            confirm={{
                              title: "Entrar como esta empresa?",
                              description: `Você vai ver e usar o Console exatamente como ${c.name} vê, com acesso completo à empresa. Suas telas de administrador ficam ocultas até você sair do modo assistido.`,
                              confirmLabel: "Entrar como esta empresa",
                            }}
                          >
                            <input type="hidden" name="companyId" value={c.id} />
                          </ActionForm>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.listFooter}>
              {rows.length} {rows.length === 1 ? "empresa" : "empresas"}{" "}
              {archived
                ? "na lista de arquivados"
                : "na lista de clientes ativos"}
            </p>
          </>
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
