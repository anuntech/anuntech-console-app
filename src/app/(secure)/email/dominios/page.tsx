import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { companies } from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import { db } from "@/lib/db";
import { mailConfigured } from "@/lib/mail/jmap";
import { domainOverview, listMailboxes } from "@/lib/mail/mail-admin";
import { canManageMail } from "@/lib/mail/mail-rules";
import { PageHeader } from "@/components/console/page-header";
import { DomainList, LinkDomainButton } from "@/components/email/domain-list";
import { MailServerProblem } from "@/components/email/mail-status";

export const metadata: Metadata = {
  title: "Domínios de e-mail",
  description: "Os domínios do servidor de e-mail e a empresa de cada um.",
};

/** E-mail › Domínios: Anuntech's own and each client's, with the link that hands a server domain to a client. */
export default async function DomainsPage() {
  const actor = await requireAdmin();
  if (!canManageMail(actor)) notFound();
  if (!mailConfigured()) return <MailServerProblem configured={false} />;
  let overview, mailboxes;
  try {
    [overview, mailboxes] = await Promise.all([domainOverview(), listMailboxes()]);
  } catch (error) {
    // The JMAP client already logged the step and the status; anything else is named, never dumped.
    console.error("[email] domains page failed", { name: error instanceof Error ? error.name : typeof error });
    return <MailServerProblem configured />;
  }
  const clients = await db
    .select({ id: companies.id, name: companies.name, document: companies.document })
    .from(companies)
    .where(eq(companies.archived, false))
    .orderBy(asc(companies.name));
  const rows = overview.rows.map((row) => ({ ...row, mailboxes: mailboxes.filter((box) => box.domain === row.domain).length }));
  return (
    <>
      <PageHeader crumbs={[{ label: "E-mail", href: "/email" }]} title="Domínios" count={rows.length} className="mb-4" />
      <DomainList rows={rows} actions={<LinkDomainButton companies={clients} linkable={overview.linkable} />} />
    </>
  );
}
