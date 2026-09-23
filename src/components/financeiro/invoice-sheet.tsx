"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Fact } from "@/components/console/fact";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createInvoice, updateDraft, updateIssuedDescription } from "@/lib/actions";
import { updateSubscription } from "@/lib/billing-public-actions";
import { currency, dateLabel } from "@/lib/format";
import {
  InvoiceFields,
  type InvoiceCompanyOption,
  type InvoiceEngagementOption,
} from "./invoice-form";
import { MoneyInput } from "./invoice-money";

export type InvoiceEditable = {
  id: string;
  description: string;
  amountCents: number;
  dueDate: string;
};
/** What can still change: everything on a draft, only the words once the
    bank holds amount and due date, the next periods of a recurrence. */
export type InvoiceEditMode = "draft" | "issued" | "subscription";

const copy: Record<
  InvoiceEditMode,
  { title: string; description: string; submit: string; pending: string }
> = {
  draft: {
    title: "Editar rascunho",
    description: "Nada foi emitido: valor e vencimento ainda podem mudar.",
    submit: "Salvar alterações",
    pending: "Salvando…",
  },
  issued: {
    title: "Editar fatura",
    description:
      "A descrição vale para a página de pagamento e os próximos avisos.",
    submit: "Salvar alterações",
    pending: "Salvando…",
  },
  subscription: {
    title: "Editar próximas cobranças",
    description:
      "Vale para os próximos períodos. Faturas já emitidas não mudam.",
    submit: "Salvar próximas cobranças",
    pending: "Salvando…",
  },
};
const actions = {
  draft: updateDraft,
  issued: updateIssuedDescription,
  subscription: updateSubscription,
};

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
  const text = copy[mode];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {invoice && (
          <ServerForm
            key={`${mode}-${invoice.id}-${open ? "open" : "closed"}`}
            action={actions[mode]}
            onSuccess={() => onOpenChange(false)}
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
              {mode === "issued" ? (
                <dl className="grid gap-4 rounded-lg border bg-secondary/40 px-4 py-3 sm:grid-cols-2">
                  <Fact label="Valor">
                    <span className="tabular-nums">
                      {currency(invoice.amountCents)}
                    </span>
                  </Fact>
                  <Fact label="Vencimento">{dateLabel(invoice.dueDate)}</Fact>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Registrados no Inter junto com o boleto e o Pix. Para
                    alterar, cancele a cobrança no banco e emita outra.
                  </p>
                </dl>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="edit-amount" className="mb-1.5">
                      {mode === "subscription" ? "Valor por período" : "Valor"}
                    </Label>
                    <MoneyInput id="edit-amount" defaultCents={invoice.amountCents} />
                  </div>
                  <div>
                    <Label htmlFor="edit-due" className="mb-1.5">
                      {mode === "subscription"
                        ? "Próximo vencimento"
                        : "Vencimento"}
                    </Label>
                    <Input
                      id="edit-due"
                      name="dueDate"
                      type="date"
                      required
                      defaultValue={invoice.dueDate}
                    />
                  </div>
                </div>
              )}
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </SheetClose>
              <SubmitButton pendingLabel={text.pending}>{text.submit}</SubmitButton>
            </SheetFooter>
          </ServerForm>
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
