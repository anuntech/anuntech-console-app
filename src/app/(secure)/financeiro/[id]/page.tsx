import { DownloadLink } from "@/components/download-link";
import Link from "next/link";
import { addressLabel } from "@/lib/company-billing";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { invoices, companies } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { cancelDraft, updateDraft } from "@/lib/actions";
import { issueCharge, syncCharge } from "@/lib/billing-actions";
import { ActionForm } from "@/components/action-form";
import { InvoiceAmount, InvoiceDueDate } from "@/components/invoice-inputs";
import { Heading, Back, Badge, Field } from "@/components/ui";
import { invoiceLabels, currency, dateLabel } from "@/lib/format";
export default async function Invoice({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({ invoice: invoices, company: companies })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .where(eq(invoices.id, id));
  if (
    !row ||
    !canAccess(actor, row.invoice.companyId, "finance") ||
    (!actor.admin && !["issued", "paid"].includes(row.invoice.status))
  )
    notFound();
  const i = row.invoice;
  return (
    <>
      <Back href="/financeiro" label="Financeiro" />
      <Heading title="Detalhes da fatura" description={row.company.name} />
      <section className="panel padded invoice-detail">
        <div className="card-top">
          <Badge status={i.status}>{invoiceLabels[i.status]}</Badge>
          <span className="muted">Vencimento: {dateLabel(i.dueDate)}</span>
        </div>
        <p className="invoice-amount">{currency(i.amountCents)}</p>
        <p className="pre-wrap">{i.description}</p>
        <hr />
        <h2>Pagamento</h2>
        <p className="muted">
          {i.status === "draft"
            ? "Esta fatura é um rascunho. Nenhuma cobrança foi emitida."
            : i.status === "cancelled"
              ? "Esta fatura foi cancelada."
              : i.status === "paid"
                ? "Pagamento confirmado."
                : "Consulte os dados de pagamento abaixo. A atualização é feita pela equipe da Anuntech."}
        </p>
        {i.status === "issued" && i.pixCopyPaste && (
          <Field label="Pix copia e cola">
            <textarea readOnly value={i.pixCopyPaste} />
          </Field>
        )}
        {i.status === "issued" && i.boletoLine && (
          <>
            <Field label="Linha digitável">
              <input readOnly value={i.boletoLine} />
            </Field>
            <DownloadLink
              className="button primary"
              href={`/api/boletos/${i.id}`}
            >
              Baixar boleto PDF
            </DownloadLink>
          </>
        )}
        {actor.admin && i.bankRequest && (
          <>
            <p className="muted">
              Situação no Inter: {i.bankStatus}.{" "}
              {i.bankCheckedAt
                ? `Consulta: ${i.bankCheckedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                : "Aguardando consulta."}
            </p>
            <ActionForm action={syncCharge} label="Consultar cobrança no Inter">
              <input type="hidden" name="id" value={i.id} />
              {!i.providerId && (
                <>
                  <p>
                    Consulte a solicitação no Inter e informe o código para
                    reconciliar esta tentativa. Não crie outra cobrança antes de
                    verificar.
                  </p>
                  <Field label="Código da solicitação no Inter">
                    <input name="providerId" required />
                  </Field>
                </>
              )}
            </ActionForm>
          </>
        )}
        <h2>Nota fiscal</h2>
        <p className="muted">
          {i.fiscalStatus === "not_requested"
            ? "Emissão ainda não solicitada."
            : "Acompanhe a emissão com a equipe da Anuntech."}
        </p>
        {actor.admin && (
          <p className="muted">
            {row.company.autoIssueNfse
              ? "Este cliente está selecionado para nota fiscal automática. A emissão ainda depende da conclusão da integração fiscal."
              : "Nota fiscal automática desativada para este cliente."}{" "}
            <Link href={`/empresas/${i.companyId}#cadastro`}>
              Configurar no cadastro do cliente
            </Link>
            .
          </p>
        )}
        {actor.admin && i.status === "draft" && !i.bankRequest && (
          <>
            <details className="edit-details">
              <summary>Emitir cobrança Pix e boleto</summary>
              <p>
                A cobrança usa os dados salvos no cadastro do cliente. Esta ação
                emite uma cobrança no Inter. O Pix depende de uma chave
                cadastrada na conta.
              </p>
              <ActionForm action={issueCharge} label="Emitir cobrança no Inter">
                <input type="hidden" name="id" value={i.id} />
                <div>
                  <strong>
                    {row.company.name} · {row.company.document}
                  </strong>
                  <p>
                    {row.company.billingAddress
                      ? addressLabel(row.company.billingAddress)
                      : "Complete o endereço no cadastro do cliente antes de emitir a cobrança."}
                  </p>
                  <Link href={`/empresas/${i.companyId}#cadastro`}>
                    Editar cadastro do cliente
                  </Link>
                </div>
                <Field label="Dias após vencimento até cancelamento no banco">
                  <input
                    name="numDiasAgenda"
                    type="number"
                    min={0}
                    max={60}
                    defaultValue={30}
                    required
                  />
                </Field>
                <label className="checkbox-field">
                  <input name="confirm" type="checkbox" value="yes" required />{" "}
                  Conferi o valor, vencimento e pagador e confirmo a emissão no
                  Inter.
                </label>
              </ActionForm>
            </details>
            <details className="edit-details">
              <summary>Editar rascunho</summary>
              <ActionForm action={updateDraft} label="Salvar alterações">
                <input type="hidden" name="id" value={i.id} />
                <Field label="Descrição">
                  <textarea
                    name="description"
                    required
                    maxLength={1000}
                    defaultValue={i.description}
                  />
                </Field>
                <InvoiceAmount defaultCents={i.amountCents} />
                <InvoiceDueDate defaultValue={i.dueDate} />
              </ActionForm>
            </details>
            <ActionForm
              action={cancelDraft}
              label="Cancelar rascunho"
              danger
              className="compact-form"
            >
              <input type="hidden" name="id" value={i.id} />
            </ActionForm>
          </>
        )}
      </section>
    </>
  );
}
