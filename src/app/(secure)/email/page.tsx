import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ForwardIcon, GlobeIcon } from "lucide-react";
import { requireAdmin } from "@/lib/access/access";
import { getAccountEmails } from "@/lib/account/account-identity";
import { mailConfigured } from "@/lib/mail/jmap";
import { listMailboxes } from "@/lib/mail/mail-admin";
import { MAIL_DOMAINS, canManageMail } from "@/lib/mail/mail-rules";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { MailboxList } from "@/components/email/mailbox-list";
import { NewMailboxButton } from "@/components/email/mailbox-sheets";
import { MailServerProblem } from "@/components/email/mail-status";

export const metadata: Metadata = {
  title: "E-mail",
  description: "As caixas de e-mail da Anuntech: espaço, senha, apelidos e a configuração dos aparelhos.",
};

/** Phase 1: the team manages the anuntech.com mailboxes. Reading and sending happen in each person's own app. */
export default async function EmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireAdmin();
  if (!canManageMail(actor)) notFound();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 160) : "";
  if (!mailConfigured()) return <MailServerProblem configured={false} />;
  let rows;
  try {
    rows = await listMailboxes();
  } catch (error) {
    // The JMAP client already logged the step and the status; anything else is named, never dumped.
    console.error("[email] page failed", { name: error instanceof Error ? error.name : typeof error });
    return <MailServerProblem configured />;
  }
  const emails = await getAccountEmails(actor.user.id, actor.user.email);
  const list = rows.map((row) => ({
    ...row,
    own: [row.address, ...row.aliases.map((alias) => `${alias}@${row.domain}`)].some((address) => emails.includes(address)),
  }));
  return (
    <>
      <PageHeader title="E-mail" count={list.length} className="mb-4" />
      <MailboxList
        rows={list}
        query={query}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/email/redirecionamentos">
                <ForwardIcon />
                Redirecionamentos
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/email/dns">
                <GlobeIcon />
                DNS
              </Link>
            </Button>
            <NewMailboxButton domain={MAIL_DOMAINS[0]} />
          </>
        }
      />
    </>
  );
}
