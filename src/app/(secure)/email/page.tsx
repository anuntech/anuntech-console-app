import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ForwardIcon, GlobeIcon } from "lucide-react";
import { getActor } from "@/lib/access/access";
import { mailConfigured } from "@/lib/mail/jmap";
import { areaMailboxes, mailArea, managesArea } from "@/lib/mail/mail-area";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { StatusPage } from "@/components/console/status-page";
import { DomainSwitcher } from "@/components/email/domain-switcher";
import { MailboxList } from "@/components/email/mailbox-list";
import { NewMailboxButton } from "@/components/email/mailbox-sheets";
import { AssistedMail, MailServerProblem, mailCrumbs } from "@/components/email/mail-status";

export const metadata: Metadata = {
  title: "E-mail",
  description: "As caixas de e-mail da empresa: espaço, senha, apelidos e a configuração dos aparelhos.",
};

const at = (path: string, domain: string) => `${path}?dominio=${encodeURIComponent(domain)}`;

/**
 * The mailboxes of one managed domain at a time (`?dominio=`), opened by the
 * e-mail product in Produtos (`?empresa=`) or, for anuntech.com, from
 * Configurações › E-mail. The team and a client's Administrador manage them;
 * a Membro sees only their own mailbox. Reading and sending happen in each
 * person's own app.
 */
export default async function EmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getActor();
  if (actor.assisting) return <AssistedMail />;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 160) : "";
  // Only the team reads which variables are missing; a client reads that the server did not answer.
  if (!mailConfigured()) return <MailServerProblem configured={!actor.admin} />;
  const failed = (error: unknown) => {
    // The JMAP client already logged the step and the status; anything else is named, never dumped.
    console.error("[email] page failed", { name: error instanceof Error ? error.name : typeof error });
    return <MailServerProblem configured />;
  };
  let area, rows;
  try {
    area = await mailArea(actor, params);
  } catch (error) {
    return failed(error);
  }
  if (!area) notFound();
  const { role, current, choices, companyName } = area;
  const manages = managesArea(role);
  const crumbs = mailCrumbs(area.companyId);
  if (!current)
    return (
      <>
        <PageHeader crumbs={crumbs} title="E-mail" className="mb-4" />
        <StatusPage
          layout="inline"
          title="Nenhum domínio de e-mail ainda"
          description={
            area.companyId
              ? `${companyName} ainda não tem um domínio no servidor de e-mail da Anuntech. Abra um chamado para a equipe preparar o domínio.`
              : "O servidor não tem nenhum dos domínios da Anuntech. Confira o servidor de e-mail."
          }
          actions={
            area.companyId && !actor.admin ? (
              <Button asChild>
                <Link href="/chamados/novo">Abrir chamado</Link>
              </Button>
            ) : undefined
          }
        />
      </>
    );
  try {
    rows = await areaMailboxes(actor, area);
  } catch (error) {
    return failed(error);
  }
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title="E-mail"
        count={rows.length}
        // A Membro sees only their own mailbox: no domain to name, and the company is theirs.
        meta={manages ? [current.domain, companyName] : undefined}
        className="mb-4"
      />
      <MailboxList
        rows={rows}
        query={query}
        manages={manages}
        actions={
          manages && (
            <>
              <DomainSwitcher choices={choices} current={current.domain} />
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
          )
        }
      />
    </>
  );
}
