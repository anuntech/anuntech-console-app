"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlusIcon } from "lucide-react";
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
import { CompanyFields, type CompanyFormValues } from "./company-form";
import { createCompany, updateCompany } from "@/lib/actions";

/** Create or edit a company in a side sheet; the task never leaves the list. */
export function CompanySheet({
  open,
  onOpenChange,
  company,
  companyId,
  lookupEnabled = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: CompanyFormValues | null;
  companyId?: string;
  lookupEnabled?: boolean;
}) {
  const editing = !!companyId;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <ServerForm
          key={open ? "open" : "closed"}
          action={editing ? updateCompany : createCompany}
          onSuccess={() => editing && onOpenChange(false)}
          className="flex h-full min-h-0 flex-col"
        >
          {editing && <input type="hidden" name="id" value={companyId} />}
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>
              {editing ? "Editar dados da empresa" : "Cadastrar empresa"}
            </SheetTitle>
            <SheetDescription>
              {editing
                ? "As alterações valem para as próximas cobranças e notas."
                : "Informe os dados do cliente. O CNPJ preenche o restante."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <CompanyFields company={company} lookupEnabled={lookupEnabled} />
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel={editing ? "Salvando…" : "Cadastrando…"}>
              {editing ? "Salvar alterações" : "Cadastrar empresa"}
            </SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}

/** Header action for the list; `?nova=1` (old deep links, the dock) opens it. */
export function NewCompanyButton() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wanted = params.get("nova") !== null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Cadastrar empresa
      </Button>
      <CompanySheet
        open={open || wanted}
        onOpenChange={(next) => {
          setOpen(next);
          // Dropping the param is what actually closes a deep-linked sheet.
          if (!next && wanted) router.replace(pathname, { scroll: false });
        }}
      />
    </>
  );
}
