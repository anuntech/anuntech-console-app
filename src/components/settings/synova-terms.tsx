"use client";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/console/server-form";
import { prepareSynovaTerms } from "@/lib/service-terms/terms-actions";

/** Synova clients whose licence was signed outside the Console and still have no conditions. */
export function SynovaTerms({ companies }: { companies: string[] }) {
  if (!companies.length) return null;
  const count = companies.length === 1 ? "1 cliente" : `${companies.length} clientes`;
  return (
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
  );
}
