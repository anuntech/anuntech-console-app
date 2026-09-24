"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/console/date-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createInvoice, updateDraft } from "@/lib/actions";
import { reissueInvoice } from "@/lib/billing-actions";
import { updateSubscription } from "@/lib/billing-public-actions";
import {
  InvoiceFields,
  type InvoiceCompanyOption,
  type InvoiceEngagementOption,
} from "./invoice-form";
import { MoneyInput } from "./invoice-money";
import { ChargeTermsFields } from "./charge-terms-fields";
import { sameTerms, type ChargeTerms } from "@/lib/billing-terms";

export type InvoiceEditable = {
  id: string;
  description: string;
  amountCents: number;
  dueDate: string;
  terms: ChargeTerms;
  /** The invoice belongs to a recurrence, so terms can apply to the next ones too. */
  recurring: boolean;
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
    submit: "Salvar alterações",
  },
  issued: {
    title: "Editar fatura",
    description: "Descrição, valor e vencimento desta cobrança.",
    submit: "Salvar alterações",
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

function EditForm({
  mode,
  invoice,
  onDone,
}: {
  mode: InvoiceEditMode;
  invoice: InvoiceEditable;
  onDone: () => void;
}) {
  const text = copy[mode];
  const [cents, setCents] = useState(invoice.amountCents);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [terms, setTerms] = useState(invoice.terms);
  // A changed amount, date or condition sends the issued charge back to the bank.
  const reissue =
    mode === "issued" &&
    (cents !== invoice.amountCents ||
      dueDate !== invoice.dueDate ||
      !sameTerms(terms, invoice.terms));
  return (
    <ServerForm
      action={actions[mode]}
      onSuccess={onDone}
      className="flex h-full min-h-0 flex-col"
    >
      <input type="hidden" name="id" value={invoice.id} />
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle>{text.title}</SheetTitle>
        <SheetDescription>{text.description}</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
        <FormError />
        <div>
          <Label htmlFor="edit-description" className="mb-1.5">
            Descrição
          </Label>
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
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit-amount" className="mb-1.5">
              {mode === "subscription" ? "Valor por período" : "Valor"}
            </Label>
            <MoneyInput
              id="edit-amount"
              defaultCents={invoice.amountCents}
              onCentsChange={setCents}
            />
          </div>
          <div>
            <Label htmlFor="edit-due" className="mb-1.5">
              {mode === "subscription" ? "Próximo vencimento" : "Vencimento"}
            </Label>
            <DateField
              id="edit-due"
              name="dueDate"
              required
              value={dueDate}
              onChange={setDueDate}
            />
          </div>
        </div>
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
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
        <SheetClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </SheetClose>
        <SubmitButton pendingLabel={reissue ? "Reemitindo…" : "Salvando…"}>
          {reissue ? "Salvar e reemitir" : text.submit}
        </SubmitButton>
      </SheetFooter>
    </ServerForm>
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {invoice && (
          <EditForm
            key={`${mode}-${invoice.id}-${open ? "open" : "closed"}`}
            mode={mode}
            invoice={invoice}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
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
}: {
  companies: InvoiceCompanyOption[];
  engagements: InvoiceEngagementOption[];
  companyId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        // Let the sheet slide out before the route unmounts it.
        setTimeout(() => router.back(), 300);
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <ServerForm
          action={createInvoice}
          className="flex h-full min-h-0 flex-col"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Nova cobrança</SheetTitle>
            <SheetDescription>
              Quem paga, o que está sendo cobrado e as condições.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <InvoiceFields
              companies={companies}
              engagements={engagements}
              companyId={companyId}
              autoFocus
            />
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Salvando…">Salvar rascunho</SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}
