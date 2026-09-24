import "server-only";
import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { UserRoundIcon } from "lucide-react";
import {
  accountEmails,
  consoleStaffMembers,
  memberships,
  user,
} from "@/db/schema";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/access";
import { resolveAccountIdentity } from "@/lib/account-identity";
import { isCatalogAvatar } from "@/lib/avatar-catalog";
import { settingsEnvironment } from "@/lib/environment";
import { roleLabels } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, SectionTitle } from "@/components/console/page-header";
import { IllustratedAvatar } from "./illustrated-avatar";
import { InviteForm, MemberMenu } from "./member-actions";

type Person = {
  key: string;
  memberId: string;
  name: string | null;
  email: string;
  image: string | null;
  self: boolean;
  pending: boolean;
  role: string;
  /** Rows nobody can act on (the Console owner). */
  fixed?: string;
};

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

function PeopleTable({
  people,
  companyId,
  staff,
  canAct,
}: {
  people: Person[];
  companyId?: string;
  staff: boolean;
  canAct: boolean;
}) {
  if (!people.length)
    return (
      <EmptyState
        icon={<UserRoundIcon />}
        title="Ninguém ainda"
        description="Convide a primeira pessoa pelo formulário acima."
        className="py-10"
      />
    );
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-6">Pessoa</TableHead>
          <TableHead>Permissão</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead className="w-12 pr-4">
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => (
          <TableRow key={person.key}>
            <TableCell className="pl-6">
              <span className="flex items-center gap-3">
                <Portrait image={person.image} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {person.name || person.email}
                    {person.self && (
                      <span className="text-muted-foreground"> (você)</span>
                    )}
                  </span>
                  {person.name && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {person.email}
                    </span>
                  )}
                </span>
              </span>
            </TableCell>
            <TableCell>
              <Badge variant={person.role === "manager" || person.fixed ? "default" : "secondary"}>
                {person.fixed || roleLabels[person.role] || person.role}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {person.pending ? "Aguardando primeiro acesso" : "Ativo"}
            </TableCell>
            <TableCell className="pr-4 text-right">
              {canAct && !person.self && !person.fixed && (
                <MemberMenu
                  memberId={person.memberId}
                  email={person.email}
                  companyId={companyId}
                  role={person.role}
                  pending={person.pending}
                  staff={staff}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

async function staffPeople(actor: Actor): Promise<Person[]> {
  const configuredOwner = process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase();
  const ownerIdentity = configuredOwner
    ? await resolveAccountIdentity(configuredOwner)
    : null;
  const [ownerUser] = ownerIdentity?.userId
    ? await db
        .select({ name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, ownerIdentity.userId))
    : [];
  const entries = await db
    .select({
      member: consoleStaffMembers,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      verified: user.emailVerified,
    })
    .from(consoleStaffMembers)
    .leftJoin(
      accountEmails,
      and(
        eq(accountEmails.email, consoleStaffMembers.email),
        isNotNull(accountEmails.verifiedAt),
      ),
    )
    .leftJoin(
      user,
      or(eq(user.email, consoleStaffMembers.email), eq(user.id, accountEmails.userId)),
    )
    .where(eq(consoleStaffMembers.active, true))
    .orderBy(asc(consoleStaffMembers.email));
  const people: Person[] = [];
  if (configuredOwner)
    people.push({
      key: "owner",
      memberId: "",
      name: ownerUser?.name || null,
      email: ownerIdentity?.primaryEmail || configuredOwner,
      image: ownerUser?.image || null,
      self: actor.owner,
      pending: false,
      role: "manager",
      fixed: "Proprietário",
    });
  const seen = new Set<string>();
  for (const entry of entries) {
    if (
      entry.member.email === configuredOwner ||
      (ownerIdentity?.userId && entry.userId === ownerIdentity.userId)
    )
      continue;
    const key = entry.userId || entry.member.email;
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({
      key,
      memberId: entry.member.id,
      name: entry.name || null,
      email: entry.email || entry.member.email,
      image: entry.image || null,
      self: entry.userId === actor.user.id,
      pending: !entry.userId || !entry.verified,
      role: "manager",
    });
  }
  return people;
}

async function companyPeople(actor: Actor, companyId: string): Promise<Person[]> {
  const entries = await db
    .select({
      member: memberships,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      verified: user.emailVerified,
    })
    .from(memberships)
    .leftJoin(
      accountEmails,
      and(
        eq(accountEmails.email, memberships.email),
        isNotNull(accountEmails.verifiedAt),
      ),
    )
    .leftJoin(
      user,
      or(eq(user.email, memberships.email), eq(user.id, accountEmails.userId)),
    )
    .where(and(eq(memberships.companyId, companyId), eq(memberships.active, true)))
    .orderBy(asc(memberships.email));
  const people = new Map<string, Person>();
  for (const entry of entries) {
    const key = entry.userId || entry.member.email;
    const current = people.get(key);
    if (current) {
      if (entry.member.role === "manager") current.role = "manager";
      continue;
    }
    people.set(key, {
      key,
      memberId: entry.member.id,
      name: entry.name || null,
      email: entry.email || entry.member.email,
      image: entry.image || null,
      self: entry.userId === actor.user.id,
      pending: !entry.userId || !entry.verified,
      role: entry.member.role,
    });
  }
  return [...people.values()];
}

export async function MembersSection() {
  const { actor, companyId } = await settingsEnvironment();
  const staff = actor.admin;
  const people = staff
    ? await staffPeople(actor)
    : await companyPeople(actor, companyId!);
  const canInvite = staff ? actor.owner : true;
  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title={
            <span className="flex items-center gap-2">
              Pessoas do ambiente
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground">
                {people.length}
              </span>
            </span>
          }
          description={
            staff
              ? "Quem administra o Console da Anuntech."
              : "Quem entra no Console em nome da sua empresa."
          }
        />
      </CardHeader>
      {canInvite && (
        <CardContent className="border-b pb-6">
          <InviteForm companyId={companyId ?? undefined} staff={staff} />
        </CardContent>
      )}
      <CardContent className="px-0">
        <PeopleTable
          people={people}
          companyId={companyId ?? undefined}
          staff={staff}
          canAct={canInvite}
        />
      </CardContent>
    </Card>
  );
}
