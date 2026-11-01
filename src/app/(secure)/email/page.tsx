import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ForwardIcon, GlobeIcon } from "lucide-react";
import { getActor } from "@/lib/access/access";
import { mailConfigured } from "@/lib/mail/jmap";
import { areaMailboxes, mailArea, managesArea } from "@/lib/mail/mail-area";
import { mailProduct, pendingDomains } from "@/lib/mail/mail-setup";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { StatusPage } from "@/components/console/status-page";
import { DomainSwitcher } from "@/components/email/domain-switcher";
import { MailboxList } from "@/components/email/mailbox-list";
import { NewMailboxButton } from "@/components/email/mailbox-sheets";
import { AssistedMail, MailServerProblem, mailCrumbs } from "@/components/email/mail-status";
import { PendingDomains } from "@/components/email/setup-pieces";
import { AddDomainButton } from "@/components/email/setup-sheets";

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
  // A client's domains still waiting for the proof, and whether the company may add one (its e-mail product active).
  const [pending, product] = manages && area.companyId ? await Promise.all([pendingDomains(area.companyId), mailProduct(area.companyId)]) : [[], null];
  const canAdd = !!area.companyId && manages && (role === "team" || product?.state === "active");
  if (!current)
    return (
      <>
        <PageHeader crumbs={crumbs} title="E-mail" meta={area.companyId ? [companyName] : undefined} className="mb-4" />
        <PendingDomains claims={pending} />
        {!pending.length && (
          <StatusPage
            layout="inline"
            title="Nenhum domínio de e-mail ainda"
            description={
              !area.companyId
                ? "O servidor não tem nenhum dos domínios da Anuntech. Confira o servidor de e-mail."
                : canAdd
                  ? `Adicione o domínio de ${companyName} (o que vem depois do @). O Console mostra os registros para publicar no DNS do domínio e confere se ficaram certos.`
                  : manages
                    ? `${companyName} ainda não tem o e-mail da Anuntech ativo. Contrate em Produtos para adicionar o domínio.`
                    : `${companyName} ainda não tem um domínio de e-mail. Peça ao Administrador da empresa.`
            }
            actions={
              canAdd && area.companyId ? (
                <AddDomainButton companyId={area.companyId} primary />
              ) : area.companyId && manages && !actor.admin ? (
                <Button asChild>
                  <Link href="/produtos">Ir para Produtos</Link>
                </Button>
              ) : undefined
            }
          />
        )}
        {pending.length > 0 && canAdd && area.companyId && (
          <div>
            <AddDomainButton companyId={area.companyId} />
          </div>
        )}
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
      <PendingDomains claims={pending} />
      <MailboxList
        rows={rows}
        query={query}
        manages={manages}
        actions={
          manages && (
            <>
              <DomainSwitcher choices={choices} current={current.domain} />
              {canAdd && area.companyId && <AddDomainButton companyId={area.companyId} />}
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
