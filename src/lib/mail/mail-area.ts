import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { companies } from "@/db/schema";
import type { Actor } from "../access/access";
import { getAccountEmails } from "../account/account-identity";
import { db } from "../db";
import { domainChoices, listMailboxes } from "./mail-admin";
import { mailRole, ownsMailbox, pickDomain, type MailRole } from "./mail-rules";
import type { MailboxRow } from "./mail-types";

export type MailChoice = { domain: string; companyId: string | null; companyName: string };

/**
 * Where a page of the e-mail area opens and what the person may do there.
 * `?dominio=` names the domain; `?empresa=` (the e-mail product's card in
 * Produtos) the company, opening its first domain; with neither, the team
 * gets Anuntech's own and a client the first company with a linked domain.
 * The domain switcher offers only the same company's domains.
 * Undefined: the page answers 404. A domain or company out of reach reads
 * exactly like one that does not exist. Assisted access never gets here.
 */
export async function mailArea(actor: Actor, params: { dominio?: unknown; empresa?: unknown }) {
  if (actor.assisting) return undefined;
  const visible: MailChoice[] = (await domainChoices()).filter((choice) => mailRole(actor, choice.companyId));
  const asked = typeof params.dominio === "string" && params.dominio.trim() ? params.dominio : undefined;
  let companyId: string | null;
  if (asked) {
    const found = pickDomain(visible, asked);
    if (!found) return undefined;
    companyId = found.companyId;
  } else if (typeof params.empresa === "string" && params.empresa) {
    const company = z.uuid().safeParse(params.empresa);
    if (!company.success) return undefined;
    companyId = company.data;
  } else if (actor.admin) companyId = null;
  else {
    const first = visible.find((choice) => choice.companyId);
    if (!first) return undefined;
    companyId = first.companyId;
  }
  const role = mailRole(actor, companyId);
  if (!role) return undefined;
  const choices = visible.filter((choice) => choice.companyId === companyId);
  let companyName = choices[0]?.companyName ?? "Anuntech";
  if (companyId && !choices.length) {
    // A company without a linked domain yet: its name, for the page to say so.
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));
    if (!company) return undefined;
    companyName = company.name;
  }
  return { role, companyId, companyName, choices, current: pickDomain(choices, asked) ?? null };
}

export type MailArea = NonNullable<Awaited<ReturnType<typeof mailArea>>>;

/**
 * The mailboxes a page lists: the current domain's for whoever manages it;
 * for a Membro, only their own, in any of the company's domains (there is no
 * domain to choose). `own` marks the person's own mailbox either way.
 */
export async function areaMailboxes(actor: Actor, area: MailArea): Promise<MailboxRow[]> {
  const emails = await getAccountEmails(actor.user.id, actor.user.email);
  const mark = (row: MailboxRow) => ({
    ...row,
    own: [row.address, ...row.aliases.map((alias) => `${alias}@${row.domain}`)].some((address) => emails.includes(address)),
  });
  if (area.role === "member") {
    const domains = new Set(area.choices.map((choice) => choice.domain));
    return (await listMailboxes())
      .filter((row) => domains.has(row.domain) && row.managed && ownsMailbox(row.address, emails))
      .map((row) => ({ ...row, own: true }));
  }
  return area.current ? (await listMailboxes(area.current.domain)).map(mark) : [];
}

/** The role's power in the screens: managing everything, or only one's own mailbox. */
export const managesArea = (role: MailRole) => role === "team" || role === "manager";
