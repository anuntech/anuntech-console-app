"use client";
import { useState } from "react";
import { UserRoundIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/console/page-header";
import { ListCard } from "@/components/console/list-view";
import { TablePagination } from "@/components/console/table-pagination";
import { isCatalogAvatar } from "@/lib/account/avatar-catalog";
import { roleLabels } from "@/lib/format";
import { clampPage, DEFAULT_PAGE_SIZE, offsetOf, pageCountOf, type PageQuery } from "@/lib/list-query";
import { IllustratedAvatar } from "./illustrated-avatar";
import { InviteForm, MemberMenu } from "./member-actions";
import { scopeSummary, type MemberScope, type ScopeEngagement } from "./member-access-fields";

export type Person = {
  key: string;
  memberId: string;
  /** The person's account, once there is one (the app's API draws their photo by it). */
  userId?: string | null;
  name: string | null;
  email: string;
  image: string | null;
  self: boolean;
  pending: boolean;
  role: string;
  /** Rows nobody can act on (the Console owner). */
  fixed?: string;
  /** A Membro's products, services and projects (company environments only). */
  scope?: MemberScope;
};

const pill = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

function Portrait({ image }: { image: string | null }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-muted-foreground">
      {image && isCatalogAvatar(image) ? (
        <IllustratedAvatar image={image} size={36} />
      ) : (
        <UserRoundIcon className="size-4" />
      )}
    </span>
  );
}

/**
 * The people of the environment as the standard list table. The whole list
 * comes from the server (identities are merged in code), so it pages here,
 * in memory; the invite form sits where other lists keep their toolbar.
 */
export function MembersTable({
  people,
  companyId,
  staff,
  canAct,
  engagements,
}: {
  people: Person[];
  companyId?: string;
  staff: boolean;
  /** May invite, change and remove people. */
  canAct: boolean;
  /** The company's products, services and projects, to choose what each Membro sees. */
  engagements?: ScopeEngagement[];
}) {
  const [paging, setPaging] = useState<PageQuery>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  // After a removal the last page can empty out; show the one before it.
  const shown = clampPage(paging, people.length);
  const rows = people.slice(offsetOf(shown), offsetOf(shown) + shown.pageSize);
  return (
    <ListCard
      label="Pessoas do ambiente"
      toolbar={
        canAct && (
          <div className="w-full py-1">
            <InviteForm companyId={companyId} staff={staff} engagements={engagements} />
          </div>
        )
      }
      // Up to 10 people fit on one page: no footer to page through (the rule of ListPagination).
      footer={
        (people.length > 10 || shown.page > 1) && (
        <TablePagination
          page={shown.page}
          pageCount={pageCountOf(people.length, shown.pageSize)}
          pageSize={shown.pageSize}
          total={people.length}
          noun={["pessoa", "pessoas"]}
          onPageChange={(page) => setPaging({ ...shown, page })}
          onPageSizeChange={(pageSize) => setPaging({ page: 1, pageSize })}
        />
        )
      }
    >
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Pessoa</TableHead>
              <TableHead className="hidden md:table-cell">Permissão</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((person) => (
              <TableRow key={person.key}>
                {/* PrimaryCell's look without its link: a person has no page to open. */}
                <TableCell className="w-full max-w-0 min-w-40 py-3 pl-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <Portrait image={person.image} />
                    <span className="min-w-0">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {person.name || person.email}
                          {person.self && <span className="text-muted-foreground"> (você)</span>}
                        </span>
                        {/* Only the exception gets a badge: someone who has signed in is the normal case. */}
                        {person.pending && (
                          <span className={cn(pill, "bg-warning-soft text-warning")}>
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                            Aguardando primeiro acesso
                          </span>
                        )}
                      </span>
                      {person.name && (
                        <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
                      )}
                      {/* Phones have no Permissão column: the role rides under the person. */}
                      <span className="block truncate text-xs text-muted-foreground md:hidden">
                        {person.fixed || roleLabels[person.role] || person.role}
                        {person.role === "member" && person.scope?.access === "selected" && ` · Vê: ${scopeSummary(person.scope)}`}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="flex flex-col items-start gap-1">
                    <Badge variant={person.role === "manager" || person.fixed ? "default" : "secondary"}>
                      {person.fixed || roleLabels[person.role] || person.role}
                    </Badge>
                    {/* Only a limited Membro says what it sees; "Tudo da empresa" is the normal case (as on the company page). */}
                    {person.role === "member" && person.scope?.access === "selected" && (
                      <span className="text-xs text-muted-foreground">{`Vê: ${scopeSummary(person.scope)}`}</span>
                    )}
                  </span>
                </TableCell>
                {/* MemberMenu brings RowActions' own trigger and its dialogs. */}
                <TableCell className="w-12 pr-3 text-right" data-row-ignore>
                  {canAct && !person.self && !person.fixed && (
                    <MemberMenu
                      memberId={person.memberId}
                      email={person.email}
                      companyId={companyId}
                      role={person.role}
                      pending={person.pending}
                      staff={staff}
                      engagements={engagements}
                      scope={person.scope}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<UserRoundIcon />}
          title="Ninguém ainda"
          description={
            canAct ? "Convide a primeira pessoa pelo formulário acima." : "Quem entrar no ambiente aparece aqui."
          }
        />
      )}
    </ListCard>
  );
}
