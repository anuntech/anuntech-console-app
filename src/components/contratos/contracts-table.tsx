"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2Icon,
  CalendarClockIcon,
  FileSignatureIcon,
  FileTextIcon,
  PenLineIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CompanyCell,
  DownloadMenuItem,
  FilterChip,
  LinkRow,
  ListCard,
  ListPagination,
  PrimaryCell,
  RowActions,
} from "@/components/console/list-view";
import { EmptyState } from "@/components/console/page-header";
import { SearchField } from "@/components/console/search-field";
import { ConfirmDialog } from "@/components/console/server-form";
import { deleteContract } from "@/lib/contract-deletion";
import { canDeleteContract } from "@/lib/deletion-rules";
import { dateLabel, dateTimeLabel, relativeLabel } from "@/lib/format";
import {
  clientContractFilters,
  contractFilterLabels,
  contractFilters,
  contractListHref,
  contractTerm,
  contractTermLabel,
  type ContractQuery,
  type ContractStatusFilter,
} from "@/lib/contract-table";
import { ContractStatusBadge } from "./contract-badges";
import type { ContractRow } from "./contract-row";

export type { ContractRow } from "./contract-row";

type Party = ContractRow["signedBy"][number];
/**
 * A row as the staff list gets it: every signature on any version and the
 * amendments pointing at it decide whether it can be deleted. Rows without
 * the counts never offer deletion.
 */
type ListedContract = ContractRow & { signatures?: number; amendments?: number };

/** "Aditivo de …" for amendments, otherwise the company (clients with several) and the project. */
function subtitle(row: ContractRow, companyInSubtitle: boolean) {
  if (row.kind === "amendment") return row.parentTitle ? `Aditivo de ${row.parentTitle}` : "Aditivo";
  return [companyInSubtitle ? row.company : null, row.engagement].filter(Boolean).join(" · ") || "Contrato";
}

function Term({ row, today }: { row: ContractRow; today: string }) {
  const term = row.status === "signed" ? contractTerm({ startsAt: row.startsAt, endsAt: row.endsAt }, today) : null;
  const termLabel = term ? contractTermLabel(term) : null;
  if (row.endsAt)
    return (
      <>
        <span className={cn(term?.state === "expired" ? "text-destructive" : "text-foreground")}>
          {row.startsAt ? `${dateLabel(row.startsAt)} – ` : "até "}
          {dateLabel(row.endsAt)}
        </span>
        {termLabel && term?.state !== "upcoming" && (
          <span className={cn("block font-medium", term?.state === "expired" ? "text-destructive" : "text-warning")}>
            {termLabel}
          </span>
        )}
      </>
    );
  if (row.startsAt) return <span className="text-foreground">a partir de {dateLabel(row.startsAt)}</span>;
  return <span className="text-muted-foreground">—</span>;
}

function Signatures({ row }: { row: ContractRow }) {
  if (row.status === "draft" || row.status === "cancelled") return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-2 text-xs">
      {(["client", "anuntech"] as const).map((party) => {
        const done = row.signedBy.includes(party);
        return (
          <span key={party} className={cn("inline-flex items-center gap-1", done ? "text-success" : "text-muted-foreground")}>
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", done ? "bg-success" : "bg-muted-foreground/40")} />
            {party === "client" ? "Cliente" : "Anuntech"}
            <span className="sr-only">{done ? " assinou" : " ainda não assinou"}</span>
          </span>
        );
      })}
    </span>
  );
}

function Actions({ row, admin, party }: { row: ListedContract; admin: boolean; party: Party }) {
  const [deleting, setDeleting] = useState(false);
  const href = `/contratos/${row.id}`;
  const noun = row.kind === "amendment" ? "aditivo" : "contrato";
  const deletable =
    admin &&
    row.signatures !== undefined &&
    row.amendments !== undefined &&
    canDeleteContract({ status: row.status, signatures: row.signatures, amendments: row.amendments, kind: row.kind });
  // The same rule and link as the contract page: drafts only for staff, never cancellations.
  const pdf = row.status !== "cancelled" && (admin || row.status !== "draft");
  // Signing happens on the contract page (reading, consent); this only takes the person there.
  const canSign = row.status === "sent" && !row.signedBy.includes(party);
  return (
    <RowActions
      label={row.title}
      extra={
        deletable && (
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            action={deleteContract}
            fields={{ id: row.id, from: "list" }}
            title={row.kind === "amendment" ? "Excluir aditivo?" : "Excluir contrato?"}
            description={`“${row.title}” sai do Console junto com as versões enviadas, se houver. Isso não pode ser desfeito.`}
            confirmLabel="Excluir"
            destructive
          />
        )
      }
    >
      <DropdownMenuItem asChild>
        <Link href={href}>
          <FileTextIcon />
          Abrir {noun}
        </Link>
      </DropdownMenuItem>
      {canSign && (
        <DropdownMenuItem asChild>
          <Link href={href}>
            <PenLineIcon />
            Ler e assinar
          </Link>
        </DropdownMenuItem>
      )}
      {admin && (
        <DropdownMenuItem asChild>
          <Link href={`/empresas/${row.companyId}`}>
            <Building2Icon />
            Ver empresa
          </Link>
        </DropdownMenuItem>
      )}
      {pdf && (
        <>
          <DropdownMenuSeparator />
          <DownloadMenuItem href={`/api/contratos/${row.id}/pdf`} filename={`${row.title}.pdf`}>
            {row.status === "signed" ? "Baixar PDF assinado" : "Baixar PDF"}
          </DownloadMenuItem>
        </>
      )}
      {deletable && (
        <>
          <DropdownMenuSeparator />
          {/* Opened after the menu closes, so the dialog takes focus from a settled page. */}
          <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => setDeleting(true), 0)}>
            <Trash2Icon />
            Excluir
          </DropdownMenuItem>
        </>
      )}
    </RowActions>
  );
}

/**
 * Every contract the viewer can see, one page at a time. Staff get every
 * client's contracts with the company and signature columns and the expiry
 * alert; clients get their own sent and signed contracts, with what still
 * waits for their signature under the situation.
 */
export function ContractsTable({
  rows,
  query,
  total,
  pageCount,
  admin,
  showCompany,
  alerts = { expiring: 0, expired: 0 },
  companyFilter = null,
  now,
  today,
}: {
  rows: ListedContract[];
  query: ContractQuery;
  total: number;
  pageCount: number;
  admin: boolean;
  /** False when everything belongs to the viewer's single company. */
  showCompany: boolean;
  /** Staff only: signed contracts about to end or past their end date. */
  alerts?: { expiring: number; expired: number };
  companyFilter?: { id: string; name: string } | null;
  /** ISO instant the page was rendered at, so relative times hydrate equal. */
  now: string;
  /** São Paulo civil date, for the validity warnings. */
  today: string;
}) {
  const router = useRouter();
  const href = (patch: Partial<ContractQuery>) => contractListHref({ ...query, ...patch });
  const go = (patch: Partial<ContractQuery>) => router.push(href(patch), { scroll: false });
  const filtered = !!query.search || !!query.company || query.status !== "all";
  // A company filter already says whose contracts these are.
  const spansCompanies = showCompany && !query.company;
  const companyColumn = admin && spansCompanies;
  const party: Party = admin ? "anuntech" : "client";
  const showAlerts =
    admin && (alerts.expiring > 0 || alerts.expired > 0) && query.status !== "expiring" && query.status !== "expired";
  return (
    <ListCard
      label="Lista de contratos"
      toolbar={
        <>
          <SearchField
            value={query.search}
            onChange={(search) => go({ search, page: 1 })}
            placeholder={showCompany ? "Buscar por título ou empresa" : "Buscar por título"}
          />
          {companyFilter && (
            <FilterChip
              icon={<Building2Icon />}
              label={companyFilter.name}
              removeHref={href({ company: "", page: 1 })}
            />
          )}
          <Select value={query.status} onValueChange={(status) => go({ status: status as ContractStatusFilter, page: 1 })}>
            <SelectTrigger aria-label="Filtrar por situação" className="w-[212px]">
              <SelectValue>{contractFilterLabels[query.status]}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {(admin ? contractFilters : clientContractFilters).map((status) => (
                <SelectItem key={status} value={status}>
                  {contractFilterLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      footer={
        <ListPagination
          page={query.page}
          pageSize={query.pageSize}
          total={total}
          pageCount={pageCount}
          noun={["contrato", "contratos"]}
          hrefFor={({ page, pageSize = query.pageSize }) => href({ page, pageSize })}
        />
      }
    >
      {showAlerts && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-warning-soft/60 px-4 py-2 text-xs text-foreground"
        >
          <CalendarClockIcon className="size-3.5 text-warning" />
          {alerts.expiring > 0 && (
            <Link href={href({ status: "expiring", page: 1 })} className="font-medium hover:text-primary">
              {alerts.expiring === 1
                ? "1 contrato vence nos próximos 30 dias"
                : `${alerts.expiring} contratos vencem nos próximos 30 dias`}
            </Link>
          )}
          {alerts.expiring > 0 && alerts.expired > 0 && <span aria-hidden="true">·</span>}
          {alerts.expired > 0 && (
            <Link href={href({ status: "expired", page: 1 })} className="font-medium text-destructive hover:underline">
              {alerts.expired === 1 ? "1 contrato vencido" : `${alerts.expired} contratos vencidos`}
            </Link>
          )}
        </p>
      )}
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Contrato</TableHead>
              {companyColumn && <TableHead className="hidden md:table-cell">Empresa</TableHead>}
              <TableHead>Situação</TableHead>
              <TableHead className="hidden md:table-cell">Vigência</TableHead>
              {admin && <TableHead className="hidden md:table-cell">Assinaturas</TableHead>}
              <TableHead className="hidden md:table-cell">Atualizado</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <LinkRow key={row.id} href={`/contratos/${row.id}`}>
                <PrimaryCell
                  href={`/contratos/${row.id}`}
                  title={row.title}
                  subtitle={subtitle(row, !admin && spansCompanies)}
                />
                {companyColumn && (
                  <CompanyCell>{row.company}</CompanyCell>
                )}
                <TableCell>
                  <ContractStatusBadge status={row.status} />
                  {/* Clients have no signatures column: say whose signature is missing. */}
                  {!admin && row.status === "sent" && (
                    <span
                      className={cn(
                        "mt-1 block text-xs",
                        row.signedBy.includes("client") ? "text-muted-foreground" : "font-medium text-warning",
                      )}
                    >
                      {row.signedBy.includes("client") ? "Falta a assinatura da Anuntech" : "Falta a sua assinatura"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden text-xs tabular-nums md:table-cell">
                  <Term row={row} today={today} />
                </TableCell>
                {admin && (
                  <TableCell className="hidden md:table-cell">
                    <Signatures row={row} />
                  </TableCell>
                )}
                <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums md:table-cell">
                  <time dateTime={row.updatedAt} title={dateTimeLabel(row.updatedAt)}>
                    {relativeLabel(row.updatedAt, now)}
                  </time>
                </TableCell>
                <Actions row={row} admin={admin} party={party} />
              </LinkRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<FileSignatureIcon />}
          title={filtered ? "Nenhum contrato encontrado" : "Nenhum contrato ainda"}
          description={
            filtered
              ? "Tente outro termo ou mude os filtros."
              : admin
                ? "Crie um contrato a partir de um modelo e envie para o cliente assinar."
                : "Os contratos da sua empresa com a Anuntech aparecem aqui para leitura e assinatura."
          }
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href="/contratos">Limpar filtros</Link>
              </Button>
            ) : admin ? (
              <Button asChild>
                <Link href="/contratos/novo">
                  <PlusIcon />
                  Novo contrato
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </ListCard>
  );
}
