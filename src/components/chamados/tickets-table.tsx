"use client";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2Icon,
  CheckIcon,
  HeadsetIcon,
  LockIcon,
  MessagesSquareIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/console/page-header";
import { TablePagination } from "@/components/console/table-pagination";
import { dateTimeLabel, relativeLabel } from "@/lib/format";
import { OPEN_TICKET_STATUSES } from "@/lib/ticket-status";
import {
  ticketFilterLabels,
  ticketFilters,
  ticketListHref,
  type TicketPriority,
  type TicketQuery,
  type TicketStatus,
  type TicketStatusFilter,
} from "@/lib/ticket-table";
import { CloseTicketDialog, useTicketMove } from "./ticket-actions";
import { TicketPriorityMark, TicketStatusBadge } from "./ticket-badges";

export type TicketRow = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  companyId: string;
  company: string;
  engagement: string | null;
  author: string;
  assignedTo: string | null;
  /** ISO instant. */
  updatedAt: string;
};

const isActive = (status: TicketStatus) =>
  (OPEN_TICKET_STATUSES as readonly string[]).includes(status);

function RowMenu({ ticket, admin }: { ticket: TicketRow; admin: boolean }) {
  const [closing, setClosing] = useState(false);
  const { move, form } = useTicketMove(ticket.id);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ações de ${ticket.subject}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/chamados/${ticket.id}`}>
              <MessagesSquareIcon />
              Abrir conversa
            </Link>
          </DropdownMenuItem>
          {admin && (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/empresas/${ticket.companyId}`}>
                  <Building2Icon />
                  Ver empresa
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isActive(ticket.status) && (
                <DropdownMenuItem onSelect={() => move("resolved")}>
                  <CheckIcon />
                  Marcar como resolvido
                </DropdownMenuItem>
              )}
              {!isActive(ticket.status) && (
                <DropdownMenuItem onSelect={() => move("open")}>
                  <RotateCcwIcon />
                  Reabrir chamado
                </DropdownMenuItem>
              )}
              {ticket.status !== "closed" && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setTimeout(() => setClosing(true), 0)}
                >
                  <LockIcon />
                  Encerrar chamado
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {admin && form}
      {admin && (
        <CloseTicketDialog
          ticketId={ticket.id}
          open={closing}
          onOpenChange={setClosing}
        />
      )}
    </>
  );
}

export function TicketsTable({
  rows,
  query,
  total,
  pageCount,
  now,
  admin,
  showCompany,
  canCreate,
  companyFilter = null,
}: {
  rows: TicketRow[];
  query: TicketQuery;
  total: number;
  pageCount: number;
  /** ISO instant the page was rendered at, so relative times hydrate equal. */
  now: string;
  admin: boolean;
  /** False when everything belongs to the viewer's single company. */
  showCompany: boolean;
  canCreate: boolean;
  companyFilter?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const href = (patch: Partial<TicketQuery>) =>
    ticketListHref({ ...query, ...patch });
  const go = (patch: Partial<TicketQuery>) =>
    router.push(href(patch), { scroll: false });
  const filtered = !!query.search || !!query.company;

  return (
    <section
      aria-label="Lista de chamados"
      className="overflow-hidden rounded-xl border bg-card shadow-card"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <SearchField
          value={query.search}
          onChange={(search) => go({ search, page: 1 })}
          placeholder={showCompany ? "Buscar por assunto ou empresa" : "Buscar por assunto"}
        />
        {companyFilter && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background pr-1 pl-2.5 text-xs font-medium text-foreground">
            <Building2Icon className="size-3.5 text-muted-foreground" />
            <span className="max-w-[14rem] truncate">{companyFilter.name}</span>
            <Link
              href={href({ company: "", page: 1 })}
              aria-label={`Remover filtro ${companyFilter.name}`}
              className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </Link>
          </span>
        )}
        <Select
          value={query.status}
          onValueChange={(status) =>
            go({ status: status as TicketStatusFilter, page: 1 })
          }
        >
          <SelectTrigger aria-label="Filtrar por situação" className="w-[188px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {ticketFilters.map((status) => (
              <SelectItem key={status} value={status}>
                {ticketFilterLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Chamado</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Prioridade</TableHead>
              {admin && <TableHead>Responsável</TableHead>}
              <TableHead>Atualizado</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="max-w-[28rem] py-3 pl-4">
                  <Link
                    href={`/chamados/${ticket.id}`}
                    className="group block min-w-0"
                  >
                    <span className="block truncate font-medium text-foreground group-hover:text-primary">
                      {ticket.subject}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {showCompany ? ticket.company : `Aberto por ${ticket.author}`}
                      {ticket.engagement ? ` · ${ticket.engagement}` : ""}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <TicketStatusBadge status={ticket.status} />
                </TableCell>
                <TableCell>
                  <TicketPriorityMark priority={ticket.priority} />
                </TableCell>
                {admin && (
                  <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                    {ticket.assignedTo || "—"}
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <time
                    dateTime={ticket.updatedAt}
                    title={dateTimeLabel(ticket.updatedAt)}
                  >
                    {relativeLabel(ticket.updatedAt, now)}
                  </time>
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <RowMenu ticket={ticket} admin={admin} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<HeadsetIcon />}
          title={
            filtered
              ? "Nenhum chamado encontrado"
              : query.status === "active"
                ? admin
                  ? "Nenhum chamado em aberto"
                  : "Nenhum chamado em andamento"
                : "Nenhum chamado nesta situação"
          }
          description={
            filtered
              ? "Tente outro termo ou mude o filtro de situação."
              : query.status === "active"
                ? admin
                  ? "Tudo em dia. Novos chamados dos clientes aparecem aqui."
                  : "Quando precisar de ajuda, abra um chamado e acompanhe a conversa por aqui."
                : "Mude o filtro para ver os demais chamados."
          }
          action={
            query.search ? (
              <Button variant="outline" asChild>
                <Link href={href({ search: "", page: 1 })}>Limpar busca</Link>
              </Button>
            ) : canCreate && !filtered && query.status === "active" && !admin ? (
              <Button asChild>
                <Link href="/chamados/novo">
                  <PlusIcon />
                  Abrir chamado
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      <TablePagination
        page={query.page}
        pageCount={pageCount}
        pageSize={query.pageSize}
        total={total}
        noun={["chamado", "chamados"]}
        onPageChange={(page) => go({ page })}
        onPageSizeChange={(pageSize) => go({ pageSize, page: 1 })}
      />
    </section>
  );
}
