import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { invoices, companies } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { cancelDraft, updateDraft } from "@/lib/actions";
import { issueCharge, syncCharge } from "@/lib/billing-actions";
import { ActionForm } from "@/components/action-form";
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
    .select({ invoice: invoices, company: companies.name })
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
      <Heading title="Detalhes da fatura" description={row.company} />
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
            <a className="button primary" href={`/api/boletos/${i.id}`}>
              Baixar boleto PDF
            </a>
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
        {actor.admin && i.status === "draft" && !i.bankRequest && (
          <>
            <details className="edit-details">
              <summary>Emitir cobrança Pix e boleto</summary>
              <p>
                Confira o cadastro da empresa e informe o endereço do pagador.
                Esta ação emite uma cobrança no Inter. O Pix depende de uma
                chave cadastrada na conta.
              </p>
              <ActionForm action={issueCharge} label="Emitir cobrança no Inter">
                <input type="hidden" name="id" value={i.id} />
                <Field label="Endereço">
                  <input name="endereco" required maxLength={100} />
                </Field>
                <Field label="Número">
                  <input name="numero" required maxLength={10} />
                </Field>
                <Field label="Bairro">
                  <input name="bairro" required maxLength={60} />
                </Field>
                <Field label="Cidade">
                  <input name="cidade" required maxLength={60} />
                </Field>
                <Field label="UF">
                  <select name="uf" required defaultValue="">
                    <option value="" disabled>
                      Selecione
                    </option>
                    {[
                      "AC",
                      "AL",
                      "AP",
                      "AM",
                      "BA",
                      "CE",
                      "DF",
                      "ES",
                      "GO",
                      "MA",
                      "MT",
                      "MS",
                      "MG",
                      "PA",
                      "PB",
                      "PR",
                      "PE",
                      "PI",
                      "RJ",
                      "RN",
                      "RS",
                      "RO",
                      "RR",
                      "SC",
                      "SP",
                      "SE",
                      "TO",
                    ].map((uf) => (
                      <option key={uf}>{uf}</option>
                    ))}
                  </select>
                </Field>
                <Field label="CEP">
                  <input
                    name="cep"
                    required
                    inputMode="numeric"
                    maxLength={9}
                  />
                </Field>
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
                <label>
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
                <Field label="Valor (R$)">
                  <input
                    name="amount"
                    required
                    inputMode="decimal"
                    defaultValue={(i.amountCents / 100)
                      .toFixed(2)
                      .replace(".", ",")}
                  />
                </Field>
                <Field label="Vencimento">
                  <input
                    name="dueDate"
                    type="date"
                    required
                    defaultValue={i.dueDate}
                  />
                </Field>
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
