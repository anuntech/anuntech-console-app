"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { FormField } from "@/components/console/form-field";
import { FormSheet, useRouteSheet } from "@/components/console/form-sheet";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createEngagement } from "@/lib/actions";
import { updateProject } from "@/lib/projects/task-actions";

export type ProjectCompanyOption = CompanyOption;
export type ProjectFormValues = {
  id?: string;
  name: string;
  description: string | null;
};

/**
 * Fields shared by creating and editing. Names match the actions. Rendered
 * as siblings so the sheet and the card space them with their own `gap-5`.
 */
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
    <>
      <input type="hidden" name="kind" value="project" />
      {companies &&
        (companies.length === 1 ? (
          <input type="hidden" name="companyId" value={companies[0].id} />
        ) : (
          <FormField label="Empresa" htmlFor="project-company">
            <CompanyField
              id="project-company"
              name="companyId"
              required
              companies={companies}
              defaultValue={companyId}
            />
          </FormField>
        ))}
      <FormField label="Nome" htmlFor="project-name">
        <Input
          id="project-name"
          name="name"
          required
          maxLength={160}
          autoFocus={autoFocus}
          defaultValue={values?.name ?? ""}
          placeholder="Ex.: Site institucional"
        />
      </FormField>
      <FormField label="Descrição" htmlFor="project-description">
        <Textarea
          id="project-description"
          name="description"
          maxLength={3000}
          rows={4}
          defaultValue={values?.description ?? ""}
          placeholder="O que é, para quem e o que se espera."
          className="min-h-24"
        />
      </FormField>
    </>
  );
}

/** Create in a sheet (from the list) or edit an existing project. */
export function ProjectSheet({
  open,
  onOpenChange,
  companies,
  companyId,
  values,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies?: ProjectCompanyOption[];
  companyId?: string;
  values?: ProjectFormValues | null;
  /** Editing only: shows "Excluir" in the footer; the caller opens its confirmation. */
  onDelete?: () => void;
}) {
  const editing = !!values?.id;
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Editar projeto" : "Novo projeto"}
      description={
        editing
          ? "Nome e descrição."
          : "O projeto fica vinculado à empresa e ganha um quadro de tarefas."
      }
      action={editing ? updateProject : createEngagement}
      formKey={values?.id ?? "new"}
      submitLabel={editing ? "Salvar" : "Criar projeto"}
      pendingLabel={editing ? "Salvando…" : "Criando…"}
      onDelete={editing ? onDelete : undefined}
    >
      {editing && <input type="hidden" name="id" value={values!.id} />}
      <ProjectFields
        companies={editing ? undefined : companies}
        companyId={companyId}
        values={values}
        autoFocus
      />
    </FormSheet>
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
  const sheet = useRouteSheet();
  return <ProjectSheet {...sheet} companies={companies} companyId={companyId} />;
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
    // Follows the page header in, a beat later.
    <Card className="reveal-fade max-w-2xl">
      <ServerForm action={createEngagement} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <ProjectFields companies={companies} companyId={companyId} autoFocus />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/projetos">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Criando…">Criar projeto</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
