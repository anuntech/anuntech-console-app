import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/access/access";
import { timeLabel } from "@/lib/format";
import { mailConfigured } from "@/lib/mail/jmap";
import { MailRefusal, dnsHealth, domainChoices } from "@/lib/mail/mail-admin";
import { canManageMail, pickDomain } from "@/lib/mail/mail-rules";
import { PageHeader } from "@/components/console/page-header";
import { DnsHealth } from "@/components/email/dns-health";
import { DomainSwitcher } from "@/components/email/domain-switcher";
import { MailServerProblem } from "@/components/email/mail-status";
import { StatusPage } from "@/components/console/status-page";

export const metadata: Metadata = {
  title: "Saúde do DNS",
  description: "Os registros do domínio que fazem o e-mail chegar e não cair no spam.",
};

export default async function DnsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireAdmin();
  if (!canManageMail(actor)) notFound();
  if (!mailConfigured()) return <MailServerProblem configured={false} />;
  const params = await searchParams;
  const failed = (error: unknown) => {
    console.error("[email] dns page failed", { name: error instanceof Error ? error.name : typeof error });
    return <MailServerProblem configured />;
  };
  let choices, health;
  try {
    choices = await domainChoices();
  } catch (error) {
    return failed(error);
  }
  const current = pickDomain(choices, params.dominio);
  if (!current) notFound();
  const { domain } = current;
  try {
    health = await dnsHealth(domain);
  } catch (error) {
    if (error instanceof MailRefusal) return <StatusPage layout="inline" title="Não deu para conferir o DNS" description={error.message} />;
    return failed(error);
  }
  const missing = health.checks.filter((check) => check.status === "missing").length;
  return (
    <>
      <PageHeader
        crumbs={[{ label: "E-mail", href: `/email?dominio=${encodeURIComponent(domain)}` }]}
        title="Saúde do DNS"
        meta={[
          domain,
          current.companyName,
          missing ? `${missing} ${missing === 1 ? "item para corrigir" : "itens para corrigir"}` : "Tudo certo",
          `Conferido às ${timeLabel(health.checkedAt)}`,
        ]}
        description="Os registros que fazem o e-mail chegar e não cair no spam. Corrija no painel de DNS do domínio; a mudança leva alguns minutos para aparecer."
        actions={<DomainSwitcher choices={choices} current={domain} />}
      />
      <DnsHealth domain={domain} checks={health.checks} />
    </>
  );
}
