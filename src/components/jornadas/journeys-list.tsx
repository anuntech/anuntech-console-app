"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { PlusIcon, UserRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/console/page-header";
import { SearchField } from "@/components/console/search-field";
import { LinkRow, ListCard, PrimaryCell } from "@/components/console/list-view";
import { CardGrid, CardTile, GridCard, useListLayout, ViewToggle } from "@/components/console/list-grid";
import { PersonAvatar } from "@/components/console/person-avatar";
import { dateTimeLabel, relativeLabel } from "@/lib/format";
import type { ListLayout } from "@/lib/list-layout";
import { JOURNEY_STALLED_DAYS, journeyFilterLabels as filterLabels, journeyFilters, type JourneyFilter } from "@/lib/journeys/journey-model";
import { CompanyTile } from "@/components/empresas/company-tile";
import { JourneyProgress, JourneyStatusBadge } from "./journey-detail";
import type { JourneyListRow } from "./journey-types";


function Stalled({ row }: { row: JourneyListRow }) {
  if (!row.stalled) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-caption font-medium text-warning" title={`Sem mudança há mais de ${JOURNEY_STALLED_DAYS} dias`}>
      Parada
    </span>
  );
}

/** Every journey: where it is, how much is done and the next step; the team opens one to work on it. */
export function JourneysList({
  rows,
  search,
  status,
  now,
  view,
  actions,
}: {
  rows: JourneyListRow[];
  search: string;
  status: JourneyFilter;
  now: string;
  view: ListLayout;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const [layout, chooseLayout] = useListLayout("journeys", view);
  const href = (patch: { search?: string; status?: JourneyFilter }) => {
    const params = new URLSearchParams();
    const nextSearch = patch.search ?? search;
    const nextStatus = patch.status ?? status;
    if (nextSearch) params.set("q", nextSearch);
    if (nextStatus !== "active") params.set("situacao", nextStatus);
    const query = params.toString();
    return query ? `/jornadas?${query}` : "/jornadas";
  };
  const filtered = !!search || status !== "active";
  return (
    <ListCard
      fill
      empty={rows.length === 0}
      label="Lista de jornadas"
      actions={actions}
      layout={<ViewToggle view={layout} onChange={chooseLayout} />}
      toolbar={
        <>
          <SearchField value={search} onChange={(value) => router.push(href({ search: value }), { scroll: false })} placeholder="Buscar por projeto ou cliente" />
          <Select value={status} onValueChange={(value) => router.push(href({ status: value as JourneyFilter }), { scroll: false })}>
            <SelectTrigger aria-label="Filtrar por situação" className="w-[168px]">
              <SelectValue>{filterLabels[status]}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {journeyFilters.map((filter) => (
                <SelectItem key={filter} value={filter}>
                  {filterLabels[filter]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    >
      {rows.length && layout === "grid" ? (
        <CardGrid>
          {rows.map((row) => (
            <GridCard
              key={row.id}
              href={`/jornadas/${row.id}`}
              // The client's own tile, as in Empresas; a lead has no company yet.
              leading={row.lead ? <CardTile><UserRoundIcon /></CardTile> : <CompanyTile name={row.who} />}
              title={row.title}
              subtitle={row.who}
              footer={
                <>
                  <JourneyStatusBadge status={row.status} />
                  <Stalled row={row} />
                  <time dateTime={row.updatedAt} title={dateTimeLabel(row.updatedAt)} className="ml-auto shrink-0">
                    {relativeLabel(row.updatedAt, now)}
                  </time>
                </>
              }
            >
              <p className="m-0 flex flex-wrap justify-between gap-x-3 text-muted-foreground">
                <span className="font-medium text-foreground">{row.stage}</span>
                <span className="tabular-nums">
                  {row.done} de {row.total} passos
                </span>
              </p>
              <JourneyProgress done={row.done} total={row.total} />
              {row.next && (
                <p className="m-0 truncate text-muted-foreground">
                  Agora: <span className="text-foreground">{row.next}</span>
                </p>
              )}
            </GridCard>
          ))}
        </CardGrid>
      ) : rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Jornada</TableHead>
              <TableHead className="hidden md:table-cell">Etapa</TableHead>
              <TableHead className="hidden lg:table-cell">Agora</TableHead>
              <TableHead className="hidden md:table-cell">Progresso</TableHead>
              <TableHead className="hidden md:table-cell">Atualizada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <LinkRow key={row.id} href={`/jornadas/${row.id}`}>
                <PrimaryCell href={`/jornadas/${row.id}`} title={row.title} subtitle={row.who} />
                <TableCell className="hidden md:table-cell">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <JourneyStatusBadge status={row.status} />
                    <span className="text-sm text-foreground">{row.stage}</span>
                    <Stalled row={row} />
                  </span>
                </TableCell>
                <TableCell className="hidden max-w-[240px] truncate text-muted-foreground lg:table-cell">{row.next ?? "Nada pronto agora"}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2.5">
                    <JourneyProgress done={row.done} total={row.total} className="w-20" />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {row.done}/{row.total}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                  <span className="flex items-center gap-2">
                    {row.owner && <PersonAvatar person={row.owner} size={20} tone="staff" />}
                    <time dateTime={row.updatedAt} title={dateTimeLabel(row.updatedAt)}>
                      {relativeLabel(row.updatedAt, now)}
                    </time>
                  </span>
                </TableCell>
              </LinkRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          art={filtered ? "busca" : "projetos"}
          title={filtered ? "Nenhuma jornada encontrada" : "Nenhuma jornada em andamento"}
          description={
            filtered
              ? "Tente outro termo ou mude a situação."
              : "Cada projeto de cliente tem uma jornada: do primeiro contato à hospedagem, com o próximo passo sempre à vista."
          }
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href="/jornadas" scroll={false}>
                  Limpar filtros
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/jornadas/nova">
                  <PlusIcon />
                  Nova jornada
                </Link>
              </Button>
            )
          }
        />
      )}
    </ListCard>
  );
}
