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

export type ProjectCompanyOption = { id: string; name: string };
export type ProjectFormValues = {
  id?: string;
  name: string;
  description: string | null;
};

/** Fields shared by creating and editing. Names match the actions. */
export function ProjectFields({
  companies,
  companyId,
  values,
  autoFocus = false,
}: {
  /** Only when creating: which company the work belongs to. */
  companies?: ProjectCompanyOption[];
  companyId?: string;
  values?: ProjectFormValues | null;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-5">
      <input type="hidden" name="kind" value="project" />
      {companies &&
        (companies.length === 1 ? (
          <input type="hidden" name="companyId" value={companies[0].id} />
        ) : (
          <div>
            <Label htmlFor="project-company" className="mb-1.5">
              Empresa
            </Label>
            <NativeSelect
              id="project-company"
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
        <Label htmlFor="project-name" className="mb-1.5">
          Nome
        </Label>
        <Input
          id="project-name"
          name="name"
          required
          maxLength={160}
          autoFocus={autoFocus}
          defaultValue={values?.name ?? ""}
          placeholder="Ex.: Site institucional"
        />
      </div>
      <div>
        <Label htmlFor="project-description" className="mb-1.5">
          Descrição
        </Label>
        <Textarea
          id="project-description"
          name="description"
          maxLength={3000}
          rows={4}
          defaultValue={values?.description ?? ""}
          placeholder="O que é, para quem e o que se espera."
          className="min-h-24"
        />
      </div>
    </div>
  );
}

/** Create in a sheet (from the list) or edit an existing project. */
export function ProjectSheet({
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
  values?: ProjectFormValues | null;
}) {
  const editing = !!values?.id;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <ServerForm
          key={open ? "open" : "closed"}
          action={editing ? updateProject : createEngagement}
          onSuccess={() => editing && onOpenChange(false)}
          className="flex h-full min-h-0 flex-col"
        >
          {editing && <input type="hidden" name="id" value={values!.id} />}
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{editing ? "Editar projeto" : "Novo projeto"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Nome e descrição."
                : "O projeto fica vinculado à empresa e ganha um quadro de tarefas."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <ProjectFields
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
            <SubmitButton pendingLabel={editing ? "Salvando…" : "Criando…"}>
              {editing ? "Salvar alterações" : "Criar"}
            </SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}

/** /projetos/novo reached by navigation. */
export function NewProjectSheet({
  companies,
  companyId,
}: {
  companies: ProjectCompanyOption[];
  companyId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <ProjectSheet
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

/** /projetos/novo on a direct load. */
export function NewProjectForm({
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
          <ProjectFields companies={companies} companyId={companyId} autoFocus />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/projetos">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Criando…">Criar</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
