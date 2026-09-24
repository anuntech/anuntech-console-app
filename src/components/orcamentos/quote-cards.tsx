"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CalculatorIcon, DownloadIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DownloadLink } from "@/components/console/download-link";
import { EmptyState } from "@/components/console/page-header";
import { SearchField } from "@/components/console/search-field";
import { currency, dateLabel } from "@/lib/format";
import { hoursLabel, quoteExpired, quoteListHref, type QuoteQuery } from "@/lib/quote-model";
import { QuoteStatusBadge, validityText } from "./quote-badges";
import type { QuoteRow } from "./quote-row";

/**
 * The client's view: one card per proposal. A company rarely holds more
 * than a few, so the search only appears once the list needs it.
 */
export function QuoteCards({
  rows,
  query,
  showCompany,
  today,
}: {
  rows: QuoteRow[];
  query: QuoteQuery;
  showCompany: boolean;
  today: string;
}) {
  const router = useRouter();
  const searchable = rows.length > 6 || !!query.search;
  return (
    <>
      {searchable && (
        <div className="mb-4">
          <SearchField
            value={query.search}
            onChange={(search) => router.push(quoteListHref({ ...query, search }), { scroll: false })}
            placeholder={showCompany ? "Buscar por título ou empresa" : "Buscar por título"}
          />
        </div>
      )}
      {rows.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const waiting = row.status === "sent" && !quoteExpired(row.status, row.validUntil, today);
            const validity = validityText(row.status, row.validUntil, today);
            return (
              <li key={row.id} className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-5">
                    <CalculatorIcon />
                  </span>
                  <QuoteStatusBadge status={row.status} validUntil={row.validUntil} today={today} />
                </div>
                <div className="min-w-0">
                  <h2 className="m-0 line-clamp-2 text-base leading-6 font-semibold text-foreground">
                    <Link href={`/orcamentos/${row.id}`} className="hover:text-primary">
                      {row.title}
                    </Link>
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                    nº {row.number}
                    {showCompany && ` · ${row.company}`}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-foreground tabular-nums">{currency(row.totalCents)}</p>
                  <p className="m-0 text-xs text-muted-foreground tabular-nums">{hoursLabel(row.hoursMin, row.hoursMax)} estimadas</p>
                  <p className={cn("mt-2 text-xs", validity ? "text-warning" : "text-muted-foreground")}>
                    {validity
                      ? `${validity} · até ${dateLabel(row.validUntil!)}`
                      : row.validUntil
                        ? `Validade ${dateLabel(row.validUntil)}`
                        : "Sem prazo de validade."}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3">
                  {row.status === "accepted" ? (
                    <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                      <DownloadLink href={`/api/orcamentos/${row.id}/pdf`} filename={`Orçamento ${row.number}.pdf`}>
                        <DownloadIcon />
                        PDF
                      </DownloadLink>
                    </Button>
                  ) : (
                    <span className="truncate text-xs text-muted-foreground">
                      {waiting ? "Aguardando sua resposta" : ""}
                    </span>
                  )}
                  <Button variant={waiting ? "default" : "outline"} size="sm" asChild>
                    <Link href={`/orcamentos/${row.id}`}>
                      {waiting ? "Ver e responder" : "Ver orçamento"}
                      <ArrowRightIcon />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <section className="rounded-xl border bg-card shadow-card">
          <EmptyState
            icon={<CalculatorIcon />}
            title={query.search ? "Nada encontrado" : "Nenhum orçamento ainda"}
            description={
              query.search ? "Tente outro termo." : "As propostas da Anuntech para a sua empresa aparecem aqui, para leitura e resposta."
            }
            action={
              query.search ? (
                <Button variant="outline" asChild>
                  <Link href="/orcamentos">Limpar busca</Link>
                </Button>
              ) : undefined
            }
          />
        </section>
      )}
    </>
  );
}
