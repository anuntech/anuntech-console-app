import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { invoices, companies } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { cancelDraft, updateDraft } from "@/lib/actions";
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
              ? "Este rascunho foi cancelado."
              : i.status === "paid"
                ? "Pagamento confirmado."
                : "Os dados de pagamento serão disponibilizados pela integração bancária."}
        </p>
        <h2>Nota fiscal</h2>
        <p className="muted">
          {i.fiscalStatus === "not_requested"
            ? "Emissão ainda não solicitada."
            : "Acompanhe a emissão com a equipe da Anuntech."}
        </p>
        {actor.admin && i.status === "draft" && (
          <>
            <p className="alert">
              A emissão ficará disponível após a integração com o Inter ser
              configurada e testada.
            </p>
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
