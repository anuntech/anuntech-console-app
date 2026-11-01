import type { Metadata } from "next";
import type { ReactNode } from "react";
import { asc, eq } from "drizzle-orm";
import { companies } from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import { db } from "@/lib/db";
import { mailConfigured } from "@/lib/mail/jmap";
import { domainOverview, listMailboxes } from "@/lib/mail/mail-admin";
import { SettingsShell } from "@/components/settings/settings-shell";
import { DomainList, LinkDomainButton } from "@/components/email/domain-list";
import { MailServerProblem } from "@/components/email/mail-status";

export const metadata: Metadata = {
  title: "E-mail",
  description: "Os domínios do servidor de e-mail, a empresa de cada um e as caixas da Anuntech.",
};

/**
 * Configurações › E-mail (the team only): anuntech.com, which is no
 * company's product, and each client's domain, with the link that hands a
 * server domain to a client. A client's mailboxes open from its e-mail
 * product in Produtos; the rows here open the same pages.
 */
export default async function EmailSettingsPage() {
  await requireAdmin();
  const shell = (children: ReactNode, actions?: ReactNode) => (
    <SettingsShell section="email" title="E-mail" actions={actions}>
      {children}
    </SettingsShell>
  );
  if (!mailConfigured()) return shell(<MailServerProblem configured={false} />);
  let overview, mailboxes;
  try {
    [overview, mailboxes] = await Promise.all([domainOverview(), listMailboxes()]);
  } catch (error) {
    // The JMAP client already logged the step and the status; anything else is named, never dumped.
    console.error("[email] domains page failed", { name: error instanceof Error ? error.name : typeof error });
    return shell(<MailServerProblem configured />);
  }
  const clients = await db
    .select({ id: companies.id, name: companies.name, document: companies.document })
    .from(companies)
    .where(eq(companies.archived, false))
    .orderBy(asc(companies.name));
  const rows = overview.rows.map((row) => ({ ...row, mailboxes: mailboxes.filter((box) => box.domain === row.domain).length }));
  return shell(<DomainList rows={rows} />, <LinkDomainButton companies={clients} linkable={overview.linkable} />);
}
