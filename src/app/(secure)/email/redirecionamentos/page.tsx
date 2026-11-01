import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActor } from "@/lib/access/access";
import { mailConfigured } from "@/lib/mail/jmap";
import { listForwards } from "@/lib/mail/mail-admin";
import { mailArea, managesArea } from "@/lib/mail/mail-area";
import { PageHeader } from "@/components/console/page-header";
import { DomainSwitcher } from "@/components/email/domain-switcher";
import { ForwardList, NewForwardButton } from "@/components/email/forward-list";
import { AssistedMail, MailServerProblem, mailCrumbs } from "@/components/email/mail-status";

export const metadata: Metadata = {
  title: "Redirecionamentos",
  description: "Endereços do domínio que mandam o que chega para outros endereços.",
};

export default async function ForwardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getActor();
  if (actor.assisting) return <AssistedMail />;
  if (!mailConfigured()) return <MailServerProblem configured={!actor.admin} />;
  const params = await searchParams;
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
  // Forwards and the DNS are for whoever manages the domain; a Membro has only their own mailbox.
  if (!area?.current || !managesArea(area.role)) notFound();
  const { current, choices } = area;
  try {
    rows = await listForwards(current.domain);
  } catch (error) {
    return failed(error);
  }
  return (
    <>
      <PageHeader
        crumbs={[...mailCrumbs(area.companyId), { label: area.companyId ? "E-mail" : "Caixas", href: `/email?dominio=${encodeURIComponent(current.domain)}` }]}
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
