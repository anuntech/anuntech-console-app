import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { companyInvites } from "@/db/schema";
import { CompanyInviteLink } from "@/components/company-invite-link";
import { Heading, Back } from "@/components/ui";
import { dateLabel } from "@/lib/format";
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
        title="Cadastro por link"
        description="Envie um link individual. O cliente preenche os dados e você revisa antes de cadastrar."
      />
      <section className="panel form-panel">
        <CompanyInviteLink />
      </section>
      <section className="panel">
        <h2>Links e cadastros recebidos</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Identificação</th>
                <th>Situação</th>
                <th>Validade para envio</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td>
                    {r.status === "open" && r.expiresAt < new Date()
                      ? "Expirado"
                      : labels[r.status]}
                  </td>
                  <td>{dateLabel(r.expiresAt)}</td>
                  <td>
                    <Link href={`/empresas/convites/${r.id}`}>
                      {r.status === "submitted"
                        ? "Revisar cadastro"
                        : "Ver detalhes"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="muted">Nenhum link criado.</p>}
        </div>
      </section>
    </>
  );
}
