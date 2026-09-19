import { CheckCircle2, Clock3, FileCheck2, Link2 } from "lucide-react";
import styles from "../../management.module.css";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { companyInvites } from "@/db/schema";
import {
  approveCompanyInvite,
  revokeCompanyInvite,
} from "@/lib/company-invite-actions";
import { ActionForm } from "@/components/action-form";
import { CompanyBillingFields } from "@/components/company-billing-fields";
import { Heading, Back, Badge } from "@/components/ui";
export default async function ReviewInvite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [row] = await db
    .select()
    .from(companyInvites)
    .where(eq(companyInvites.id, id));
  if (!row) notFound();
  const expired = row.status === "open" && row.expiresAt < new Date();
  return (
    <>
      <Back href="/empresas/convites" label="Cadastros por link" />
      <Heading
        eyebrow="CADASTRO POR LINK"
        title={row.label}
        description="Confira as informações recebidas antes de adicionar a empresa ao Console."
      />
      <div className={styles.stack}>
        {row.status === "submitted" && row.payload ? (
          <div className={styles.formShell}>
            <section className={`panel ${styles.formCard}`}>
              <ActionForm
                action={approveCompanyInvite}
                label="Aprovar e cadastrar empresa"
              >
                <input type="hidden" name="inviteId" value={id} />
                <CompanyBillingFields
                  company={{ ...row.payload, autoIssueNfse: false }}
                  lockDocument={false}
                />
              </ActionForm>
            </section>
            <aside className={styles.helpCard}>
              <span className={styles.helpIcon}>
                <FileCheck2 size={19} />
              </span>
              <h2>Revisão do cadastro</h2>
              <p>
                Confira a identificação, o contato financeiro e o endereço
                informados pelo cliente.
              </p>
              <p>Aprovar não libera acesso ao painel nem envia cobranças.</p>
              <Badge status="pending">Aguardando sua revisão</Badge>
            </aside>
          </div>
        ) : (
          <section className={`panel ${styles.statusPanel}`}>
            <span className={styles.helpIcon}>
              {row.status === "approved" ? (
                <CheckCircle2 size={20} />
              ) : row.status === "revoked" || expired ? (
                <Link2 size={20} />
              ) : (
                <Clock3 size={20} />
              )}
            </span>
            <div>
              <h2>
                {row.status === "approved"
                  ? "Cadastro aprovado"
                  : row.status === "revoked"
                    ? "Link cancelado"
                    : expired
                      ? "Link expirado"
                      : "Aguardando o cliente"}
              </h2>
              <p>
                {row.status === "approved"
                  ? "A empresa já foi adicionada ao Console. Gerencie os dados e os acessos na página do cliente."
                  : row.status === "revoked"
                    ? "Este link não aceita novos envios. Gere um novo link se precisar retomar o cadastro."
                    : expired
                      ? "Gere um novo link para o cliente preencher os dados."
                      : "O cadastro ficará disponível para revisão assim que o cliente concluir o preenchimento."}
              </p>
            </div>
          </section>
        )}
        {row.companyId && (
          <div>
            <Link
              className="button primary"
              href={`/empresas/${row.companyId}`}
            >
              Abrir empresa
            </Link>
          </div>
        )}
        {(row.status === "open" || row.status === "submitted") && (
          <section className={`panel ${styles.secondaryAction}`}>
            <div>
              <h2>Cancelar este link</h2>
              <p>
                Impede novos envios por este link e descarta o cadastro
                recebido. Se necessário, gere outro.
              </p>
            </div>
            <ActionForm
              action={revokeCompanyInvite}
              label="Cancelar link"
              danger
            >
              <input type="hidden" name="inviteId" value={id} />
            </ActionForm>
          </section>
        )}
      </div>
    </>
  );
}
