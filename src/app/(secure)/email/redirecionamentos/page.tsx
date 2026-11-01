import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/access/access";
import { mailConfigured } from "@/lib/mail/jmap";
import { domainChoices, listForwards } from "@/lib/mail/mail-admin";
import { canManageMail, pickDomain } from "@/lib/mail/mail-rules";
import { PageHeader } from "@/components/console/page-header";
import { DomainSwitcher } from "@/components/email/domain-switcher";
import { ForwardList, NewForwardButton } from "@/components/email/forward-list";
import { MailServerProblem } from "@/components/email/mail-status";

export const metadata: Metadata = {
  title: "Redirecionamentos",
  description: "Endereços do domínio que mandam o que chega para outros endereços.",
};

export default async function ForwardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireAdmin();
  if (!canManageMail(actor)) notFound();
  if (!mailConfigured()) return <MailServerProblem configured={false} />;
  const params = await searchParams;
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
  if (!current) notFound();
  try {
    rows = await listForwards(current.domain);
  } catch (error) {
    return failed(error);
  }
  return (
    <>
      <PageHeader
        crumbs={[{ label: "E-mail", href: `/email?dominio=${encodeURIComponent(current.domain)}` }]}
        title="Redirecionamentos"
        count={rows.length}
        meta={[current.domain, current.companyName]}
        className="mb-4"
      />
      <ForwardList
        rows={rows}
        domain={current.domain}
        actions={
          <>
            <DomainSwitcher choices={choices} current={current.domain} />
            <NewForwardButton domain={current.domain} />
          </>
        }
      />
    </>
  );
}
