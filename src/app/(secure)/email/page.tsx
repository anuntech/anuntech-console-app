import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ForwardIcon, GlobeIcon, ListIcon } from "lucide-react";
import { requireAdmin } from "@/lib/access/access";
import { getAccountEmails } from "@/lib/account/account-identity";
import { mailConfigured } from "@/lib/mail/jmap";
import { domainChoices, listMailboxes } from "@/lib/mail/mail-admin";
import { canManageMail, pickDomain } from "@/lib/mail/mail-rules";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { StatusPage } from "@/components/console/status-page";
import { DomainSwitcher } from "@/components/email/domain-switcher";
import { MailboxList } from "@/components/email/mailbox-list";
import { NewMailboxButton } from "@/components/email/mailbox-sheets";
import { MailServerProblem } from "@/components/email/mail-status";

export const metadata: Metadata = {
  title: "E-mail",
  description: "As caixas de e-mail da Anuntech e dos clientes: espaço, senha, apelidos e a configuração dos aparelhos.",
};

const at = (path: string, domain: string) => `${path}?dominio=${encodeURIComponent(domain)}`;

/** The team manages the mailboxes of one managed domain at a time (`?dominio=`). Reading and sending happen in each person's own app. */
export default async function EmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireAdmin();
  if (!canManageMail(actor)) notFound();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 160) : "";
  if (!mailConfigured()) return <MailServerProblem configured={false} />;
  const failed = (error: unknown) => {
    // The JMAP client already logged the step and the status; anything else is named, never dumped.
    console.error("[email] page failed", { name: error instanceof Error ? error.name : typeof error });
    return <MailServerProblem configured />;
  };
  let choices, rows;
  try {
    choices = await domainChoices();
  } catch (error) {
    return failed(error);
  }
  const current = pickDomain(choices, params.dominio);
  if (current === undefined) notFound();
  if (!current)
    return (
      <StatusPage
        layout="inline"
        title="Nenhum domínio no servidor de e-mail"
        description="O servidor não tem nenhum dos domínios que o Console gerencia. Confira o servidor ou vincule um domínio em Domínios."
      />
    );
  try {
    rows = await listMailboxes(current.domain);
  } catch (error) {
    return failed(error);
  }
  const emails = await getAccountEmails(actor.user.id, actor.user.email);
  const list = rows.map((row) => ({
    ...row,
    own: [row.address, ...row.aliases.map((alias) => `${alias}@${row.domain}`)].some((address) => emails.includes(address)),
  }));
  return (
    <>
      <PageHeader title="E-mail" count={list.length} meta={[current.domain, current.companyName]} className="mb-4" />
      <MailboxList
        rows={list}
        query={query}
        actions={
          <>
            <DomainSwitcher choices={choices} current={current.domain} />
            <Button variant="outline" asChild>
              <Link href="/email/dominios">
                <ListIcon />
                Domínios
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={at("/email/redirecionamentos", current.domain)}>
                <ForwardIcon />
                Redirecionamentos
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={at("/email/dns", current.domain)}>
                <GlobeIcon />
                DNS
              </Link>
            </Button>
            <NewMailboxButton domain={current.domain} />
          </>
        }
      />
    </>
  );
}
