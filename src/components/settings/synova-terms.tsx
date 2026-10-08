"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/console/server-form";
import { prepareSynovaTerms } from "@/lib/service-terms/terms-actions";

/** Synova clients whose licence was signed outside the Console and still have no conditions. */
export function SynovaTerms({ companies, drafts }: { companies: string[]; drafts: { companyId: string; company: string }[] }) {
  if (!companies.length && !drafts.length) return null;
  const draftList = drafts.length > 0 && (
      <section aria-label="Condições do Synova a conferir" className="mb-6 rounded-xl border bg-card px-4 py-3 shadow-card">
        <p className="m-0 text-sm font-medium text-foreground">
          {drafts.length === 1 ? "1 rascunho" : `${drafts.length} rascunhos`} de condições do Synova a conferir
        </p>
        <p className="m-0 text-xs text-muted-foreground">Só depois de conferidas com o contrato as condições valem para os chamados.</p>
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm">
          {drafts.map((row) => (
            <li key={row.companyId}>
              <Link href={`/empresas/${row.companyId}`} className="font-medium text-foreground hover:text-primary">
                {row.company}
              </Link>
            </li>
          ))}
        </ul>
      </section>
  );
  if (!companies.length) return draftList;
  const count = companies.length === 1 ? "1 cliente" : `${companies.length} clientes`;
  return (
    <>
    <section aria-label="Condições do Synova" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-card">
      <div className="min-w-0 flex-1 text-sm">
        <p className="m-0 font-medium text-foreground">{count} do Synova sem condições de atendimento</p>
        <p className="m-0 text-xs text-muted-foreground">
          Sem condições conferidas, nenhum prazo aparece para o cliente. {companies.slice(0, 4).join(", ")}
          {companies.length > 4 ? ` e mais ${companies.length - 4}` : ""}.
        </p>
      </div>
      <ConfirmAction
        action={prepareSynovaTerms}
        title="Preparar as condições do Synova?"
        description={`Cria um rascunho com a ficha da Licença Synova para ${count}. Nada muda para o cliente até alguém conferir cada um com o contrato assinado, na página da empresa.`}
        confirmLabel="Preparar rascunhos"
      >
        <Button variant="outline" size="sm">
          Preparar rascunhos
        </Button>
      </ConfirmAction>
    </section>
    {draftList}
    </>
  );
}
