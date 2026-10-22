"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { ServerForm, SubmitButton } from "@/components/console/server-form";
import { keepRecord } from "@/lib/companies/cleanup-actions";
import type { CleanupItem } from "@/lib/companies/cleanup";
import { companyDisplayName } from "@/lib/companies/display-name";

/** The kind word the detail line starts with ("Chamado · CLINICA…"); the card title already says it. */
const kindWords: Record<CleanupItem["kind"], string> = {
  ticket: "Chamado",
  invoice: "Fatura",
  contract: "Contrato",
  quote: "Orçamento",
  company: "Empresa",
};

/** The detail without the kind word; for a child record what is left is its company, named for the screen. */
function detailOf(item: CleanupItem) {
  const prefix = `${kindWords[item.kind]} · `;
  if (!item.detail.startsWith(prefix)) return item.detail;
  const rest = item.detail.slice(prefix.length);
  return item.kind === "company" ? rest : companyDisplayName(rest, item.document);
}

const titles: Record<CleanupItem["kind"], string> = {
  ticket: "Chamados",
  invoice: "Faturas",
  contract: "Contratos",
  quote: "Orçamentos",
  company: "Empresas, por último",
};

/** Test-looking records, children first; each opens on its own page, where Excluir follows the usual rules. */
export function CleanupList({ items }: { items: CleanupItem[] }) {
  if (!items.length)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum registro com cara de teste.</CardContent>
      </Card>
    );
  const kinds = (["ticket", "invoice", "contract", "quote", "company"] as const).filter((kind) => items.some((i) => i.kind === kind));
  return (
    <div className="flex flex-col gap-6">
      {kinds.map((kind) => (
        <Card key={kind}>
          <CardHeader>
            <SectionTitle title={titles[kind]} description={kind === "company" ? "Exclua a empresa depois do que é dela. Paga ou com nota fiscal nunca sai." : undefined} />
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {items
              .filter((item) => item.kind === kind)
              .map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1">
                    <Link href={item.href} className="block truncate text-sm font-medium text-foreground hover:text-primary">
                      {item.kind === "company" ? companyDisplayName(item.label, item.document) : item.label}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">{detailOf(item)}</span>
                  </span>
                  {/* The name is the link that opens the record; "Abrir" beside it would be a second way to the same page. */}
                  <span className="flex gap-2">
                    <ServerForm action={keepRecord}>
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton variant="ghost" size="sm" pendingLabel="Salvando…">
                        Não é teste
                      </SubmitButton>
                    </ServerForm>
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
