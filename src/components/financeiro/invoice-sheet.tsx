"use client";
import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { DateField } from "@/components/console/date-field";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/console/form-field";
import { FormSheet, useRouteSheet } from "@/components/console/form-sheet";
import { MoneyField } from "@/components/console/money-field";
import { createInvoice, updateDraft } from "@/lib/actions";
import { reissueInvoice } from "@/lib/billing/billing-actions";
import { updateSubscription } from "@/lib/billing/billing-public-actions";
import {
  InvoiceFields,
  type InvoiceCompanyOption,
  type InvoiceEngagementOption,
  type InvoicePrefill,
} from "./invoice-form";
import { ChargeTermsFields } from "./charge-terms-fields";
import { BankDueDateField } from "./bank-due-date-field";
import { sameTerms, type ChargeTerms } from "@/lib/billing/billing-terms";

export type InvoiceEditable = {
  id: string;
  description: string;
  amountCents: number;
  dueDate: string;
  /** The boleto's date when the obligation is already past due. */
  bankDueDate: string | null;
  terms: ChargeTerms;
  /** The invoice belongs to a recurrence, so terms can apply to the next ones too. */
  recurring: boolean;
  /** Recurrence edit, monthly plans: issue the next period as soon as this one is paid. */
  issueOnPayment?: boolean;
};
/** Everything on a draft; on an issued charge too, but a new amount or due
    date means a new charge at the bank; the next periods of a recurrence. */
export type InvoiceEditMode = "draft" | "issued" | "subscription";

const copy: Record<
  InvoiceEditMode,
  { title: string; description: string; submit: string }
> = {
  draft: {
    title: "Editar rascunho",
    description: "Nada foi emitido: valor e vencimento ainda podem mudar.",
    submit: "Salvar",
  },
  issued: {
    title: "Editar fatura",
    description: "Descrição, valor e vencimento desta cobrança.",
    submit: "Salvar",
  },
  subscription: {
    title: "Editar próximas cobranças",
    description:
      "Vale para os próximos períodos. Faturas já emitidas não mudam.",
    submit: "Salvar próximas cobranças",
  },
};
const actions = {
  draft: updateDraft,
  issued: reissueInvoice,
  subscription: updateSubscription,
};

function EditSheet({
  open,
  onOpenChange,
  mode,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InvoiceEditMode;
  invoice: InvoiceEditable;
}) {
  const text = copy[mode];
  const [cents, setCents] = useState(invoice.amountCents);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [bankDueDate, setBankDueDate] = useState(invoice.bankDueDate ?? "");
  const [terms, setTerms] = useState(invoice.terms);
  // A changed amount, date or condition sends the issued charge back to the bank.
  const reissue =
    mode === "issued" &&
    (cents !== invoice.amountCents ||
      dueDate !== invoice.dueDate ||
      bankDueDate !== (invoice.bankDueDate ?? "") ||
      !sameTerms(terms, invoice.terms));
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={text.title}
      description={text.description}
      action={actions[mode]}
      submitLabel={reissue ? "Salvar e reemitir" : text.submit}
      pendingLabel={reissue ? "Reemitindo…" : "Salvando…"}
    >
      <input type="hidden" name="id" value={invoice.id} />
      <FormField label="Descrição" htmlFor="edit-description">
        <Textarea
          id="edit-description"
          name="description"
          required
          maxLength={1000}
          rows={2}
          defaultValue={invoice.description}
          autoFocus
          className="min-h-16"
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label={mode === "subscription" ? "Valor por período" : "Valor"} htmlFor="edit-amount">
          <MoneyField
            id="edit-amount"
            defaultCents={invoice.amountCents}
            onCentsChange={setCents}
          />
        </FormField>
        <FormField label={mode === "subscription" ? "Próximo vencimento" : "Vencimento"} htmlFor="edit-due">
          <DateField
            id="edit-due"
            name="dueDate"
            required
            value={dueDate}
            onChange={setDueDate}
          />
        </FormField>
      </div>
      {mode !== "subscription" && !invoice.recurring && (
        <BankDueDateField dueDate={dueDate} value={bankDueDate} onChange={setBankDueDate} idPrefix="edit" />
      )}
      <ChargeTermsFields
        idPrefix="edit-terms"
        defaultValue={invoice.terms}
        onChange={setTerms}
        scope={
          mode !== "subscription" && invoice.recurring
            ? { recurring: true, defaultValue: "this" }
            : undefined
        }
      />
      {mode === "subscription" && invoice.issueOnPayment !== undefined && (
        <div className="grid gap-1">
          <input type="hidden" name="issueOnPaymentField" value="1" />
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox name="issueOnPayment" value="yes" defaultChecked={invoice.issueOnPayment} />
            Emitir a próxima assim que esta for paga
          </Label>
          <p className="m-0 pl-6 text-xs text-muted-foreground">
            Boleto e Pix ficam disponíveis logo depois do pagamento. O aviso continua saindo 5 dias antes do vencimento.
          </p>
        </div>
      )}
      {mode === "issued" &&
        (reissue ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-warning-edge bg-warning-soft px-4 py-3 text-sm text-warning"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              O boleto e o Pix atuais são cancelados no Inter e novos são
              emitidos com estes dados e condições. O link de pagamento continua o mesmo.
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Mudar o valor, o vencimento ou as condições cancela o boleto e o
            Pix atuais no Inter e emite novos. O link de pagamento continua o mesmo.
          </p>
        ))}
    </FormSheet>
  );
}

export function InvoiceSheet({
  open,
  onOpenChange,
  mode,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InvoiceEditMode;
  invoice: InvoiceEditable | null;
}) {
  // Each opening edits a snapshot taken when it opens: fresh values every
  // time, and the same title and fields while the sheet slides out (callers
  // clear or switch `mode`/`invoice` as soon as it closes).
  const [session, setSession] = useState({ open: false, count: 0, mode, invoice });
  if (session.open !== open) {
    setSession(open ? { open, count: session.count + 1, mode, invoice } : { ...session, open });
  }
  if (!session.invoice) return null;
  return (
    <EditSheet
      key={session.count}
      open={open}
      onOpenChange={onOpenChange}
      mode={session.mode}
      invoice={session.invoice}
    />
  );
}

/**
 * /financeiro/nova reached by navigation: the sheet slides over the current
 * page; success navigates to the new draft.
 */
export function NewInvoiceSheet({
  companies,
  engagements,
  companyId,
  prefill,
}: {
  companies: InvoiceCompanyOption[];
  engagements: InvoiceEngagementOption[];
  companyId?: string;
  prefill?: InvoicePrefill | null;
}) {
  const sheet = useRouteSheet();
  return (
    <FormSheet
      {...sheet}
      title="Nova cobrança"
      description="Quem paga, o que está sendo cobrado e as condições."
      action={createInvoice}
      submitLabel="Criar rascunho"
      pendingLabel="Criando…"
    >
      <InvoiceFields
        companies={companies}
        engagements={engagements}
        companyId={companyId}
        prefill={prefill}
        autoFocus
      />
    </FormSheet>
  );
}
