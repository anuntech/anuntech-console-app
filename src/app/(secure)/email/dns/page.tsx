import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InboxIcon } from "lucide-react";
import { getActor } from "@/lib/access/access";
import { timeLabel } from "@/lib/format";
import { mailConfigured } from "@/lib/mail/jmap";
import { MailRefusal, dnsHealth } from "@/lib/mail/mail-admin";
import { mailArea, managesArea } from "@/lib/mail/mail-area";
import { mailArrival, normalizeMailDomain } from "@/lib/mail/mail-rules";
import { claimCheck, claimFor } from "@/lib/mail/mail-setup";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { DnsHealth } from "@/components/email/dns-health";
import { DomainSwitcher } from "@/components/email/domain-switcher";
import { AssistedMail, MailServerProblem, mailCrumbs } from "@/components/email/mail-status";
import { ArrivalNotice, ProviderTips } from "@/components/email/setup-pieces";
import { RecheckDnsForm, RemoveClaimButton, VerifyDomainForm } from "@/components/email/setup-sheets";
import { StatusPage } from "@/components/console/status-page";

export const metadata: Metadata = {
  title: "Saúde do DNS",
  description: "Os registros do domínio que fazem o e-mail chegar e não cair no spam.",
};

/**
 * The DNS of one domain, as a guide: for a domain still waiting for the
 * proof, the _anuntech TXT and "Conferir agora"; for a managed one, what can
 * go up now (DKIM, DMARC) and the switch from the old provider (MX, SPF, the
 * apps' names), each compared with what the server expects. Only whoever
 * manages the domain's company opens it.
 */
export default async function DnsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getActor();
  if (actor.assisting) return <AssistedMail />;
  if (!mailConfigured()) return <MailServerProblem configured={!actor.admin} />;
  const params = await searchParams;
  const failed = (error: unknown) => {
    console.error("[email] dns page failed", { name: error instanceof Error ? error.name : typeof error });
    return <MailServerProblem configured />;
  };
  let area, health;
  try {
    area = await mailArea(actor, params);
  } catch (error) {
    return failed(error);
  }
  if (!area?.current) {
    // Not on the server yet: a domain the person's company added and has not proved.
    const asked = typeof params.dominio === "string" ? normalizeMailDomain(params.dominio) : null;
    const claim = asked ? await claimFor(actor, asked, params.empresa) : null;
    if (!claim) notFound();
    const check = await claimCheck(claim);
    return (
      <>
        <PageHeader
          crumbs={[...mailCrumbs(claim.companyId), { label: "E-mail", href: `/email?empresa=${claim.companyId}` }]}
          title="Confirmar o domínio"
          meta={[claim.domain, claim.companyName, check.status === "ok" ? "Registro encontrado" : "Esperando o registro"]}
          description="Crie o registro abaixo no painel de DNS do domínio. Ele só prova que o domínio é da empresa: o e-mail de hoje continua igual."
          actions={<RemoveClaimButton id={claim.id} domain={claim.domain} />}
        />
        <DnsHealth domain={claim.domain} checks={[check]} />
        <div className="mt-4">
          <VerifyDomainForm id={claim.id} />
        </div>
        <ProviderTips />
      </>
    );
  }
  // Forwards and the DNS are for whoever manages the domain; a Membro has only their own mailbox.
  if (!managesArea(area.role)) notFound();
  const { current, choices } = area;
  const { domain } = current;
  try {
    health = await dnsHealth(domain);
  } catch (error) {
    if (error instanceof MailRefusal) return <StatusPage layout="inline" title="Não deu para conferir o DNS" description={error.message} />;
    return failed(error);
  }
  const missing = health.checks.filter((check) => check.status === "missing").length;
  const arrival = mailArrival(health.checks);
  const mailboxes = `/email?dominio=${encodeURIComponent(domain)}`;
  return (
    <>
      <PageHeader
        crumbs={[...mailCrumbs(area.companyId), { label: area.companyId ? "E-mail" : "Caixas", href: mailboxes }]}
        title="Saúde do DNS"
        meta={[
          domain,
          current.companyName,
          missing ? `${missing} ${missing === 1 ? "item para corrigir" : "itens para corrigir"}` : "Tudo certo",
          `Conferido às ${timeLabel(health.checkedAt)}`,
        ]}
        description="Os registros que fazem o e-mail chegar e não cair no spam. Corrija no painel de DNS do domínio; a mudança leva alguns minutos para aparecer."
        actions={
          <>
            <DomainSwitcher choices={choices} current={domain} />
            <RecheckDnsForm domain={domain} />
            <Button variant="outline" asChild>
              <Link href={mailboxes}>
                <InboxIcon />
                Caixas
              </Link>
            </Button>
          </>
        }
      />
      {arrival === "elsewhere" && <ArrivalNotice domain={domain} />}
      <DnsHealth domain={domain} checks={health.checks} arrival={arrival} />
      {area.companyId && <ProviderTips />}
    </>
  );
}
