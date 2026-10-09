"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { FormSheet, useRouteSheet } from "@/components/console/form-sheet";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { CompanyFields, type CompanyFormValues } from "./company-form";
import { createCompany, updateCompany } from "@/lib/actions";

const CREATE_DESCRIPTION = "Informe os dados do cliente. O CNPJ preenche o restante.";
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
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={editing ? "Editar empresa" : "Nova empresa"}
      description={editing ? "As alterações valem para as próximas cobranças e notas." : CREATE_DESCRIPTION}
      action={editing ? updateCompany : createCompany}
      formKey={open ? "open" : "closed"}
      submitLabel={editing ? "Salvar" : "Cadastrar empresa"}
      pendingLabel={editing ? "Salvando…" : "Cadastrando…"}
    >
      {editing && <input type="hidden" name="id" value={companyId} />}
      <CompanyFields company={company} lookupEnabled={lookupEnabled} />
    </FormSheet>
  );
}

/** /empresas/nova reached by navigation (dock, Painel, assistant). */
/** `journeyId`: started from a project journey (`?jornada=`), so the company is linked to it and the team goes back there. */
export function NewCompanySheet({ journeyId = "" }: { journeyId?: string }) {
  const sheet = useRouteSheet();
  return (
    <FormSheet
      {...sheet}
      size="xl"
      title="Nova empresa"
      description={CREATE_DESCRIPTION}
      action={createCompany}
      submitLabel="Cadastrar empresa"
      pendingLabel="Cadastrando…"
    >
      {journeyId && <input type="hidden" name="journeyId" value={journeyId} />}
      <CompanyFields />
    </FormSheet>
  );
}

/** /empresas/nova on a direct load. */
export function NewCompanyForm({ journeyId = "" }: { journeyId?: string }) {
  return (
    <Card className="max-w-2xl">
      <ServerForm action={createCompany} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          {journeyId && <input type="hidden" name="journeyId" value={journeyId} />}
          <CompanyFields />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/empresas">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Cadastrando…">Cadastrar empresa</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}

/** Header action for the list; `?nova=1` (old deep links) opens it too. */
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
