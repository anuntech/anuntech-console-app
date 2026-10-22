"use client";
import { ConfirmDialog } from "@/components/console/server-form";
import { deleteCompany } from "@/lib/companies/company-deletion";
import { companyDisplayName } from "@/lib/companies/display-name";

/**
 * Staff-only confirmation that deletes a company and everything that belongs
 * only to it. The server refuses while it has invoices, recurrences, contracts
 * or proposals; pages only offer it when `canDeleteCompany` agrees. From the
 * list (`fromList`) the list refreshes in place; from the company's own page
 * the action goes back to the list.
 */
export function DeleteCompanyDialog({
  company,
  fromList = false,
  open,
  onOpenChange,
}: {
  company: { id: string; name: string; document?: string | null };
  fromList?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      action={deleteCompany}
      fields={fromList ? { id: company.id, from: "list" } : { id: company.id }}
      title="Excluir empresa?"
      description={`${companyDisplayName(company.name, company.document)} sai do Console com os acessos, os chamados, os projetos, produtos e serviços, os bookmarks, as preferências de aviso e as jornadas, com anexos e anotações. O histórico de auditoria fica, sem o vínculo com a empresa. Não dá para desfazer.`}
      confirmLabel="Excluir"
      destructive
    />
  );
}
