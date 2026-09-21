import { CreationModal } from "./creation-modal";
import { BillingTypeInput } from "@/components/billing-type-input";
import { Info } from "lucide-react";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { engagements } from "@/db/schema";
import { requireAdmin, accessibleCompanies } from "@/lib/access";
import { createInvoice } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { CompanyPicker } from "@/components/company-picker";
import { InvoiceAmount, InvoiceDueDate } from "@/components/invoice-inputs";
import { Field, Empty } from "@/components/ui";
import styles from "@/app/(secure)/financeiro/finance.module.css";

export async function NewInvoice({
  intercepted = false,
}: {
  intercepted?: boolean;
}) {
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
    <CreationModal
      title="Nova cobrança"
      description="Defina o cliente e as condições da cobrança."
      path="/financeiro/nova"
      fallback="/financeiro"
      intercepted={intercepted}
    >
      <div className="stack">
        <section className={styles.section}>
          {companies.length ? (
            <ActionForm action={createInvoice} label="Salvar rascunho">
              <div className={styles.formSection}>
                <h2>Cliente e produto</h2>
                <p>Selecione quem receberá esta cobrança.</p>
                <CompanyPicker companies={companies} engagements={items} />
                <Field
                  label="Descrição"
                  hint="Informe somente o nome do produto ou serviço."
                >
                  <textarea
                    name="description"
                    required
                    maxLength={1000}
                    rows={2}
                    placeholder="Nome do produto ou serviço"
                  />
                </Field>
              </div>
              <div className={styles.formSection}>
                <h2>Condições da cobrança</h2>
                <p>Defina a frequência, o valor e a data de vencimento.</p>
                <BillingTypeInput />
                <div className="form-grid">
                  <InvoiceAmount />
                  <InvoiceDueDate />
                </div>
              </div>
              <div className={styles.note}>
                <Info size={17} aria-hidden="true" />
                <p>
                  Salvar um rascunho não gera boleto, Pix, nota fiscal ou
                  mensagem ao cliente.
                </p>
              </div>
            </ActionForm>
          ) : (
            <Empty
              title="Cadastre uma empresa primeiro"
              description="Toda fatura precisa de um cliente vinculado."
            />
          )}
        </section>
      </div>
    </CreationModal>
  );
}
