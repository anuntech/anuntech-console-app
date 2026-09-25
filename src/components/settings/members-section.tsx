import "server-only";
import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import {
  accountEmails,
  consoleStaffMembers,
  memberships,
  user,
} from "@/db/schema";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/access";
import { resolveAccountIdentity } from "@/lib/account-identity";
import { settingsEnvironment } from "@/lib/environment";
import { MembersTable, type Person } from "./members-table";

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
    <MembersTable
      people={people}
      companyId={companyId ?? undefined}
      staff={staff}
      canAct={canInvite}
    />
  );
}
