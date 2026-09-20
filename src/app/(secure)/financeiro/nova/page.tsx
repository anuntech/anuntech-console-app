import type { Metadata } from "next";
import { BillingTypeInput } from "@/components/billing-type-input";
import { Info, ReceiptText } from "lucide-react";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { engagements } from "@/db/schema";
import { requireAdmin, accessibleCompanies } from "@/lib/access";
import { createInvoice } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { CompanyPicker } from "@/components/company-picker";
import { InvoiceAmount, InvoiceDueDate } from "@/components/invoice-inputs";
import { Heading, Field, Back, Empty } from "@/components/ui";
import styles from "../finance.module.css";
export const metadata: Metadata = {
  title: "Criar fatura",
  description:
    "Prepare uma cobrança única ou recorrente e revise os dados antes da emissão.",
};

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
      <div className={styles.layout}>
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
        <aside className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.icon}>
              <ReceiptText size={18} aria-hidden="true" />
            </span>
            <div>
              <h2>Da criação ao pagamento</h2>
              <p>Você revisa os dados antes de publicar.</p>
            </div>
          </div>
          <ol className={styles.steps}>
            <li>
              <div>
                <strong>Salve o rascunho</strong>
                <p>Confira cliente, produto, valor e vencimento.</p>
              </div>
            </li>
            <li>
              <div>
                <strong>Publique a cobrança</strong>
                <p>
                  Cobranças únicas são emitidas na publicação. As recorrentes
                  são emitidas 5 dias antes de cada vencimento.
                </p>
              </div>
            </li>
            <li>
              <div>
                <strong>Acompanhe o recebimento</strong>
                <p>
                  O cliente recebe o link público de pagamento. A confirmação do
                  Inter atualiza a fatura.
                </p>
              </div>
            </li>
          </ol>
        </aside>
      </div>
    </>
  );
}
