import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { accountEmails, user } from "@/db/schema";
import { normalizeEmail } from "./permissions";

type Executor = Pick<typeof db, "select">;
export async function getAccountEmails(
  userId: string,
  primaryEmail: string,
  executor: Executor = db,
) {
  const rows = await executor
    .select({ email: accountEmails.email })
    .from(accountEmails)
    .where(
      and(
        eq(accountEmails.userId, userId),
        isNotNull(accountEmails.verifiedAt),
      ),
    );
  return [
    ...new Set([normalizeEmail(primaryEmail), ...rows.map((row) => row.email)]),
  ];
}

export async function resolveAccountIdentity(
  rawEmail: string,
  executor: Executor = db,
) {
  const email = normalizeEmail(rawEmail);
  const [primary] = await executor
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (primary)
    return {
      userId: primary.id,
      primaryEmail: primary.email,
      emails: await getAccountEmails(primary.id, primary.email, executor),
      isAlias: false,
    };
  const [alias] = await executor
    .select({ id: user.id, email: user.email })
    .from(accountEmails)
    .innerJoin(user, eq(user.id, accountEmails.userId))
    .where(
      and(eq(accountEmails.email, email), isNotNull(accountEmails.verifiedAt)),
    )
    .limit(1);
  if (alias)
    return {
      userId: alias.id,
      primaryEmail: alias.email,
      emails: await getAccountEmails(alias.id, alias.email, executor),
      isAlias: true,
    };
  return { userId: null, primaryEmail: email, emails: [email], isAlias: false };
}
