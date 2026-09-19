import Link from "next/link";
import { ArrowRight, ClipboardCheck, Link2 } from "lucide-react";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { companyInvites } from "@/db/schema";
import { CompanyInviteLink } from "@/components/company-invite-link";
import { Heading, Back, Badge, Empty } from "@/components/ui";
import { dateLabel } from "@/lib/format";
import styles from "../management.module.css";
export default async function CompanyInvites() {
  await requireAdmin();
  const rows = await db
    .select({
      id: companyInvites.id,
      label: companyInvites.label,
      status: companyInvites.status,
      expiresAt: companyInvites.expiresAt,
    })
    .from(companyInvites)
    .orderBy(desc(companyInvites.createdAt));
  const labels = {
    open: "Aguardando cliente",
    submitted: "Aguardando sua revisão",
    approved: "Aprovado",
    revoked: "Cancelado",
  };
  return (
    <>
      <Back href="/empresas" label="Empresas" />
      <Heading
        eyebrow="CLIENTES"
        title="Cadastro por link"
        description="Receba os dados do cliente e revise tudo antes de aprovar o cadastro."
      />
      <div className={styles.stack}>
        <div className={styles.formShell}>
          <section className={`panel ${styles.formCard}`}>
            <div className={styles.sectionHeader}>
              <Link2 size={19} />
              <div>
                <h2>Novo link de cadastro</h2>
                <p>Um link individual para cada cliente, válido por 7 dias.</p>
              </div>
            </div>
            <CompanyInviteLink />
          </section>
          <aside className={styles.helpCard}>
            <span className={styles.helpIcon}>
              <ClipboardCheck size={19} />
            </span>
            <h2>Você revisa antes de aprovar</h2>
            <p>
              O cliente preenche sem login. Depois do envio, o cadastro aparece
              abaixo para sua revisão.
            </p>
            <p>
              A liberação de acesso continua sendo feita na página da empresa.
            </p>
          </aside>
        </div>
        <section className="panel">
          <div className={styles.toolbar}>
            <div className={styles.toolbarTitle}>
              <h2>Links e cadastros recebidos</h2>
              <span className={styles.count}>{rows.length}</span>
            </div>
          </div>
          {rows.length ? (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  Links de cadastro de empresas
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Identificação</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Validade para envio</th>
                    <th scope="col">
                      <span className="sr-only">Ação</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const expired =
                      r.status === "open" && r.expiresAt < new Date();
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link
                            className={styles.entity}
                            href={`/empresas/convites/${r.id}`}
                          >
                            <span className={styles.avatar}>
                              <Link2 size={17} />
                            </span>
                            <span>{r.label}</span>
                          </Link>
                        </td>
                        <td>
                          <Badge
                            status={
                              expired
                                ? "paused"
                                : r.status === "approved"
                                  ? "active"
                                  : r.status === "submitted"
                                    ? "pending"
                                    : r.status
                            }
                          >
                            {expired ? "Expirado" : labels[r.status]}
                          </Badge>
                        </td>
                        <td className={styles.cellMuted}>
                          {dateLabel(r.expiresAt)}
                        </td>
                        <td>
                          <Link
                            className={styles.rowAction}
                            href={`/empresas/convites/${r.id}`}
                          >
                            {r.status === "submitted"
                              ? "Revisar cadastro"
                              : "Ver detalhes"}
                            <ArrowRight size={15} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum link criado"
              description="Gere o primeiro link acima e compartilhe com o cliente para receber os dados de cadastro."
            />
          )}
        </section>
      </div>
    </>
  );
}
