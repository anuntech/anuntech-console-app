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
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
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
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/console/page-header";
import {
  CompanyCell,
  FilterChip,
  LinkRow,
  ListCard,
  ListPagination,
  PrimaryCell,
  RowActions,
} from "@/components/console/list-view";
import { dateTimeLabel, relativeLabel } from "@/lib/format";
import { OPEN_TICKET_STATUSES } from "@/lib/tickets/ticket-status";
import {
  ticketFilterLabels,
  ticketFilters,
  ticketListHref,
  type TicketPriority,
  type TicketQuery,
  type TicketStatus,
  type TicketStatusFilter,
} from "@/lib/tickets/ticket-table";
import { canDeleteTicket } from "@/lib/deletion-rules";
import {
  CloseTicketDialog,
  DeleteTicketDialog,
  useTicketMove,
} from "./ticket-actions";
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
  /** The responsible person's e-mail, as `updateTicket` stores it. */
  assignedTo: string | null;
  /** Their name, when a Console user has that e-mail. */
  assignee?: string | null;
  /** ISO instant. */
  updatedAt: string;
};

const isActive = (status: TicketStatus) =>
  (OPEN_TICKET_STATUSES as readonly string[]).includes(status);

function TicketActions({ ticket, admin }: { ticket: TicketRow; admin: boolean }) {
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { move, form } = useTicketMove(ticket.id);
  const deletable = admin && canDeleteTicket(ticket.status);
  return (
    <RowActions
      label={ticket.subject}
      extra={
        admin && (
          <>
            {form}
            <CloseTicketDialog
              ticketId={ticket.id}
              open={closing}
              onOpenChange={setClosing}
            />
            {deletable && (
              <DeleteTicketDialog
                ticketId={ticket.id}
                subject={ticket.subject}
                open={deleting}
                onOpenChange={setDeleting}
                fromList
              />
            )}
          </>
        )
      }
    >
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
          {deletable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setTimeout(() => setDeleting(true), 0)}
              >
                <Trash2Icon />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </>
      )}
    </RowActions>
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
  const filtered =
    !!query.search || !!query.company || query.status !== "active";
  // The company matters only while the list spans several: staff get it as its
  // own column, a client with several companies keeps it in the subtitle
  // (the "Empresa" column is a staff view). A company filter makes it moot.
  const spansCompanies = showCompany && !query.company;
  const companyColumn = admin && spansCompanies;
  const subtitle = (ticket: TicketRow) =>
    [
      !admin && spansCompanies ? ticket.company : `Aberto por ${ticket.author}`,
      ticket.engagement,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <ListCard
      label="Lista de chamados"
      toolbar={
        <>
          <SearchField
            value={query.search}
            onChange={(search) => go({ search, page: 1 })}
            placeholder={showCompany ? "Buscar por assunto ou empresa" : "Buscar por assunto"}
          />
          {companyFilter && (
            <FilterChip
              icon={<Building2Icon />}
              label={companyFilter.name}
              removeHref={href({ company: "", page: 1 })}
            />
          )}
          <Select
            value={query.status}
            onValueChange={(status) =>
              go({ status: status as TicketStatusFilter, page: 1 })
            }
          >
            <SelectTrigger aria-label="Filtrar por situação" className="w-[188px]">
              <SelectValue>{ticketFilterLabels[query.status]}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {ticketFilters.map((status) => (
                <SelectItem key={status} value={status}>
                  {ticketFilterLabels[status]}
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
          noun={["chamado", "chamados"]}
          hrefFor={href}
        />
      }
    >
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Chamado</TableHead>
              {companyColumn && (
                <TableHead className="hidden md:table-cell">Empresa</TableHead>
              )}
              <TableHead>Situação</TableHead>
              <TableHead className="hidden md:table-cell">Prioridade</TableHead>
              {admin && (
                <TableHead className="hidden md:table-cell">Responsável</TableHead>
              )}
              <TableHead className="hidden md:table-cell">Atualizado</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((ticket) => (
              <LinkRow key={ticket.id} href={`/chamados/${ticket.id}`}>
                <PrimaryCell
                  href={`/chamados/${ticket.id}`}
                  title={ticket.subject}
                  subtitle={subtitle(ticket)}
                />
                {companyColumn && (
                  <CompanyCell>{ticket.company}</CompanyCell>
                )}
                <TableCell>
                  <TicketStatusBadge status={ticket.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <TicketPriorityMark priority={ticket.priority} />
                </TableCell>
                {admin && (
                  <TableCell
                    className="hidden max-w-[12rem] truncate text-muted-foreground md:table-cell"
                    title={ticket.assignee && ticket.assignedTo ? ticket.assignedTo : undefined}
                  >
                    {ticket.assignee || ticket.assignedTo || "—"}
                  </TableCell>
                )}
                <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                  <time
                    dateTime={ticket.updatedAt}
                    title={dateTimeLabel(ticket.updatedAt)}
                  >
                    {relativeLabel(ticket.updatedAt, now)}
                  </time>
                </TableCell>
                <TicketActions ticket={ticket} admin={admin} />
              </LinkRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<HeadsetIcon />}
          title={
            filtered
              ? "Nenhum chamado encontrado"
              : admin
                ? "Nenhum chamado em aberto"
                : "Nenhum chamado em andamento"
          }
          description={
            filtered
              ? "Tente outro termo ou mude os filtros."
              : admin
                ? "Tudo em dia. Novos chamados dos clientes aparecem aqui."
                : "Quando precisar de ajuda, abra um chamado e acompanhe a conversa por aqui."
          }
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link
                  href={ticketListHref({
                    status: "active",
                    search: "",
                    company: "",
                    page: 1,
                    pageSize: query.pageSize,
                  })}
                  scroll={false}
                >
                  Limpar filtros
                </Link>
              </Button>
            ) : canCreate && !admin ? (
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
    </ListCard>
  );
}
