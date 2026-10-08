"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { ServerForm, SubmitButton } from "@/components/console/server-form";
import { keepRecord } from "@/lib/companies/cleanup-actions";
import type { CleanupItem } from "@/lib/companies/cleanup";

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
                      {item.label}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  <span className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={item.href}>Abrir</Link>
                    </Button>
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
