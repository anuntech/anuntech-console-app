import { BillingTypeInput } from "@/components/billing-type-input";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { engagements } from "@/db/schema";
import { requireAdmin, accessibleCompanies } from "@/lib/access";
import { createInvoice } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { CompanyPicker } from "@/components/company-picker";
import { InvoiceAmount, InvoiceDueDate } from "@/components/invoice-inputs";
import { Heading, Field, Back, Empty } from "@/components/ui";
export default async function NewInvoice() {
  const actor = await requireAdmin();
  const companies = await accessibleCompanies(actor);
  const items = companies.length
    ? await db
        .select()
        .from(engagements)
        .where(
          inArray(
            engagements.companyId,
            companies.map((c) => c.id),
          ),
        )
    : [];
  return (
    <>
      <Back href="/financeiro" label="Financeiro" />
      <Heading
        title="Criar fatura"
        description="Revise os dados antes de emitir qualquer cobrança."
      />
      <section className="panel form-panel">
        {companies.length ? (
          <ActionForm action={createInvoice} label="Salvar rascunho">
            <CompanyPicker companies={companies} engagements={items} />
            <BillingTypeInput />
            <Field label="Descrição">
              <textarea name="description" required maxLength={1000} rows={3} />
            </Field>
            <div className="form-grid">
              <InvoiceAmount />
              <InvoiceDueDate />
            </div>
            <p className="muted">
              Salvar um rascunho não gera boleto, Pix, nota fiscal ou mensagem
              ao cliente.
            </p>
          </ActionForm>
        ) : (
          <Empty
            title="Cadastre uma empresa primeiro"
            description="Toda fatura precisa de um cliente vinculado."
          />
        )}
      </section>
    </>
  );
}
