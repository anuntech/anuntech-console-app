import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/access/access";
import { timeLabel } from "@/lib/format";
import { mailConfigured } from "@/lib/mail/jmap";
import { MailRefusal, dnsHealth } from "@/lib/mail/mail-admin";
import { MAIL_DOMAINS, canManageMail } from "@/lib/mail/mail-rules";
import { PageHeader } from "@/components/console/page-header";
import { DnsHealth } from "@/components/email/dns-health";
import { MailServerProblem } from "@/components/email/mail-status";
import { StatusPage } from "@/components/console/status-page";

export const metadata: Metadata = {
  title: "Saúde do DNS",
  description: "Os registros do domínio que fazem o e-mail chegar e não cair no spam.",
};

export default async function DnsPage() {
  const actor = await requireAdmin();
  const domain = MAIL_DOMAINS[0];
  if (!canManageMail(actor, domain)) notFound();
  if (!mailConfigured()) return <MailServerProblem configured={false} />;
  let health;
  try {
    health = await dnsHealth(domain);
  } catch (error) {
    if (error instanceof MailRefusal) return <StatusPage layout="inline" title="Não deu para conferir o DNS" description={error.message} />;
    return <MailServerProblem configured />;
  }
  const missing = health.checks.filter((check) => check.status === "missing").length;
  return (
    <>
      <PageHeader
        crumbs={[{ label: "E-mail", href: "/email" }]}
        title="Saúde do DNS"
        meta={[domain, missing ? `${missing} ${missing === 1 ? "item para corrigir" : "itens para corrigir"}` : "Tudo certo", `Conferido às ${timeLabel(health.checkedAt)}`]}
        description="Os registros que fazem o e-mail chegar e não cair no spam. Corrija no painel de DNS do domínio; a mudança leva alguns minutos para aparecer."
      />
      <DnsHealth domain={domain} checks={health.checks} />
    </>
  );
}
