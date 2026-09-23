"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { createTicket } from "@/lib/actions";
import { TicketFields, type TicketCompanyOption } from "./ticket-form";
import { useTicketUploads } from "./ticket-uploads";

/** Opens a ticket in a side sheet, the same surface Empresas uses to create. */
export function TicketSheet({
  companies,
  companyId,
  open,
  onOpenChange,
}: {
  companies: TicketCompanyOption[];
  companyId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const uploads = useTicketUploads();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <ServerForm
          key={open ? "open" : "closed"}
          action={createTicket}
          prepare={uploads}
          className="flex h-full min-h-0 flex-col"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Abrir chamado</SheetTitle>
            <SheetDescription>Como podemos ajudar?</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <TicketFields
              companies={companies}
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
            <SubmitButton pendingLabel="Abrindo…">Abrir chamado</SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}

/**
 * /chamados/novo reached by navigation: the sheet slides over the current
 * page and closing returns to it. Success navigates to the new ticket.
 */
export function NewTicketSheet({
  companies,
  companyId,
}: {
  companies: TicketCompanyOption[];
  companyId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <TicketSheet
      companies={companies}
      companyId={companyId}
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        // Let the sheet slide out before the route unmounts it.
        setTimeout(() => router.back(), 300);
      }}
    />
  );
}
