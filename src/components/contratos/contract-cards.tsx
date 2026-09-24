"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, DownloadIcon, FileSignatureIcon, FilePlusIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DownloadLink } from "@/components/console/download-link";
import { EmptyState } from "@/components/console/page-header";
import { SearchField } from "@/components/console/search-field";
import { dateLabel } from "@/lib/format";
import { contractListHref, contractStatusLabels, type ContractQuery } from "@/lib/contract-table";
import { ContractStatusBadge, ContractTermBadge } from "./contract-badges";
import { groupContracts, type ContractRow } from "./contract-row";

function SignatureDots({ row }: { row: ContractRow }) {
  if (row.status === "draft" || row.status === "cancelled") return null;
  return (
    <span className="flex items-center gap-3 text-xs">
      {(["client", "anuntech"] as const).map((party) => {
        const done = row.signedBy.includes(party);
        return (
          <span key={party} className={cn("inline-flex items-center gap-1.5", done ? "text-success" : "text-muted-foreground")}>
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", done ? "bg-success" : "bg-muted-foreground/40")} />
            {party === "client" ? "Cliente" : "Anuntech"}
            {done ? "" : " · aguardando"}
          </span>
        );
      })}
    </span>
  );
}

/** "Vigência 01/10/2026 – 30/09/2027", or one side of it. */
export function termRange(startsAt: string | null, endsAt: string | null) {
  if (startsAt && endsAt) return `${dateLabel(startsAt)} – ${dateLabel(endsAt)}`;
  if (startsAt) return `a partir de ${dateLabel(startsAt)}`;
  if (endsAt) return `até ${dateLabel(endsAt)}`;
  return null;
}

/**
 * The client's view: one card per contract, amendments listed inside it.
 * A company rarely holds more than a handful, so there are no filters;
 * the search only appears once the list is long enough to need it.
 */
export function ContractCards({
  rows,
  query,
  showCompany,
  today,
}: {
  rows: ContractRow[];
  query: ContractQuery;
  showCompany: boolean;
  today: string;
}) {
  const router = useRouter();
  const { groups, orphans } = groupContracts(rows);
  const cards = [...groups, ...orphans.map((contract) => ({ contract, amendments: [] as ContractRow[] }))];
  const searchable = rows.length > 6 || !!query.search;
  return (
    <>
      {searchable && (
        <div className="mb-4">
          <SearchField
            value={query.search}
            onChange={(search) => router.push(contractListHref({ ...query, search }), { scroll: false })}
            placeholder={showCompany ? "Buscar por título ou empresa" : "Buscar por título"}
          />
        </div>
      )}
      {cards.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ contract: row, amendments }) => {
            const range = termRange(row.startsAt, row.endsAt);
            return (
              <li key={row.id} className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-5">
                    {row.kind === "amendment" ? <FilePlusIcon /> : <FileSignatureIcon />}
                  </span>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    <ContractTermBadge status={row.status} startsAt={row.startsAt} endsAt={row.endsAt} today={today} />
                    <ContractStatusBadge status={row.status} />
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="m-0 line-clamp-2 text-base leading-6 font-semibold text-foreground">
                    <Link href={`/contratos/${row.id}`} className="hover:text-primary">
                      {row.title}
                    </Link>
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {row.kind === "amendment" && row.parentTitle
                      ? `Aditivo de ${row.parentTitle}`
                      : [showCompany ? row.company : null, row.engagement].filter(Boolean).join(" · ") || "Contrato"}
                  </p>
                  <p className={cn("mt-3 text-sm", range ? "text-foreground/80" : "text-muted-foreground")}>
                    {range ? `Vigência ${range}` : "Sem prazo definido."}
                  </p>
                  <div className="mt-2">
                    <SignatureDots row={row} />
                  </div>
                </div>
                {amendments.length > 0 && (
                  <ol className="flex flex-col gap-1.5 border-t pt-3">
                    {amendments.map((amendment) => (
                      <li key={amendment.id} className="flex items-center justify-between gap-3 text-xs">
                        <Link
                          href={`/contratos/${amendment.id}`}
                          className="min-w-0 truncate font-medium text-foreground hover:text-primary"
                        >
                          {amendment.title}
                        </Link>
                        <span
                          className={cn(
                            "shrink-0",
                            amendment.status === "sent" ? "text-warning" : "text-muted-foreground",
                          )}
                        >
                          {contractStatusLabels[amendment.status]}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-auto flex items-center justify-between gap-3">
                  {row.status === "signed" ? (
                    <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                      <DownloadLink href={`/api/contratos/${row.id}/pdf`} filename={`${row.title}.pdf`}>
                        <DownloadIcon />
                        PDF assinado
                      </DownloadLink>
                    </Button>
                  ) : (
                    <span className="truncate text-xs text-muted-foreground">
                      {row.status === "sent" ? "Leia e assine no Console" : "Ainda não enviado"}
                    </span>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/contratos/${row.id}`}>
                      {row.status === "sent" && !row.signedBy.includes("client") ? "Ler e assinar" : "Ver contrato"}
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
            icon={<FileSignatureIcon />}
            title={query.search ? "Nada encontrado" : "Nenhum contrato ainda"}
            description={
              query.search
                ? "Tente outro termo."
                : "Os contratos da sua empresa com a Anuntech aparecem aqui para leitura e assinatura."
            }
            action={
              query.search ? (
                <Button variant="outline" asChild>
                  <Link href="/contratos">Limpar busca</Link>
                </Button>
              ) : undefined
            }
          />
        </section>
      )}
    </>
  );
}
