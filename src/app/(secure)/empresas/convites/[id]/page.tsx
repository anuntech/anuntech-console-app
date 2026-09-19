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
import { Heading, Back } from "@/components/ui";
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
  return (
    <>
      <Back href="/empresas/convites" label="Cadastros por link" />
      <Heading
        title={row.label}
        description="Confira as informações recebidas. Aprovar não libera acesso ao painel nem envia cobranças."
      />
      {row.status === "submitted" && row.payload ? (
        <section className="panel form-panel">
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
      ) : (
        <p className="muted">
          {row.status === "approved"
            ? "Cadastro aprovado."
            : row.status === "revoked"
              ? "Link cancelado."
              : row.expiresAt < new Date()
                ? "Link expirado. Gere um novo link para o cliente."
                : "Aguardando o cliente preencher o cadastro."}
        </p>
      )}
      {row.companyId && (
        <Link className="button" href={`/empresas/${row.companyId}`}>
          Abrir empresa
        </Link>
      )}
      {(row.status === "open" || row.status === "submitted") && (
        <section className="panel form-panel">
          <ActionForm action={revokeCompanyInvite} label="Cancelar link" danger>
            <input type="hidden" name="inviteId" value={id} />
            <p className="muted">
              Impede novos envios por este link e descarta o cadastro recebido.
              Se necessário, gere outro.
            </p>
          </ActionForm>
        </section>
      )}
    </>
  );
}
