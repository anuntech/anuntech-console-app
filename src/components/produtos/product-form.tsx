"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
import { createEngagement } from "@/lib/actions";
import { updateProject } from "@/lib/task-actions";
import type { ProjectCompanyOption } from "@/components/projetos/project-form";

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string | null;
  url: string | null;
};

/** Fields shared by creating and editing a product. Names match the actions. */
export function ProductFields({
  companies,
  companyId,
  values,
  autoFocus = false,
}: {
  companies?: ProjectCompanyOption[];
  companyId?: string;
  values?: ProductFormValues | null;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-5">
      <input type="hidden" name="kind" value="product" />
      {companies &&
        (companies.length === 1 ? (
          <input type="hidden" name="companyId" value={companies[0].id} />
        ) : (
          <div>
            <Label htmlFor="product-company" className="mb-1.5">
              Empresa
            </Label>
            <NativeSelect
              id="product-company"
              name="companyId"
              required
              defaultValue={companyId ?? ""}
              className="bg-field"
            >
              <NativeSelectOption value="" disabled>
                Selecione a empresa
              </NativeSelectOption>
              {companies.map((company) => (
                <NativeSelectOption key={company.id} value={company.id}>
                  {company.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}
      <div>
        <Label htmlFor="product-name" className="mb-1.5">
          Nome
        </Label>
        <Input
          id="product-name"
          name="name"
          required
          maxLength={160}
          autoFocus={autoFocus}
          defaultValue={values?.name ?? ""}
          placeholder="Ex.: Synova"
        />
      </div>
      <div>
        <Label htmlFor="product-url" className="mb-1.5">
          Link do produto
        </Label>
        <Input
          id="product-url"
          name="url"
          type="url"
          inputMode="url"
          maxLength={2048}
          defaultValue={values?.url ?? ""}
          placeholder="https://"
        />
      </div>
      <div>
        <Label htmlFor="product-description" className="mb-1.5">
          Descrição
        </Label>
        <Textarea
          id="product-description"
          name="description"
          maxLength={3000}
          rows={4}
          defaultValue={values?.description ?? ""}
          placeholder="O que o produto faz para a empresa."
          className="min-h-24"
        />
      </div>
    </div>
  );
}

/** Create in a sheet (from the list) or edit an existing product. */
export function ProductSheet({
  open,
  onOpenChange,
  companies,
  companyId,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies?: ProjectCompanyOption[];
  companyId?: string;
  values?: ProductFormValues | null;
}) {
  const editing = !!values?.id;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <ServerForm
          key={open ? (values?.id ?? "open") : "closed"}
          action={editing ? updateProject : createEngagement}
          onSuccess={() => editing && onOpenChange(false)}
          className="flex h-full min-h-0 flex-col"
        >
          {editing && <input type="hidden" name="id" value={values!.id} />}
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{editing ? "Editar produto" : "Novo produto"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Nome, link e descrição."
                : "Um produto que a empresa contratou; o cliente abre pelo link."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <ProductFields
              companies={editing ? undefined : companies}
              companyId={companyId}
              values={values}
              autoFocus
            />
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel={editing ? "Salvando…" : "Cadastrando…"}>
              {editing ? "Salvar alterações" : "Cadastrar"}
            </SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}

/** /produtos/novo reached by navigation. */
export function NewProductSheet({
  companies,
  companyId,
}: {
  companies: ProjectCompanyOption[];
  companyId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <ProductSheet
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        setTimeout(() => router.back(), 300);
      }}
      companies={companies}
      companyId={companyId}
    />
  );
}

/** /produtos/novo on a direct load. */
export function NewProductForm({
  companies,
  companyId,
}: {
  companies: ProjectCompanyOption[];
  companyId?: string;
}) {
  return (
    <Card className="max-w-2xl">
      <ServerForm action={createEngagement} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <ProductFields companies={companies} companyId={companyId} autoFocus />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/produtos">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Cadastrando…">Cadastrar</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
