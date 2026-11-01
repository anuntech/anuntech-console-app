import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/access/access";
import { mailConfigured } from "@/lib/mail/jmap";
import { listForwards } from "@/lib/mail/mail-admin";
import { MAIL_DOMAINS, canManageMail } from "@/lib/mail/mail-rules";
import { PageHeader } from "@/components/console/page-header";
import { ForwardList, NewForwardButton } from "@/components/email/forward-list";
import { MailServerProblem } from "@/components/email/mail-status";

export const metadata: Metadata = {
  title: "Redirecionamentos",
  description: "Endereços do domínio que mandam o que chega para outros endereços.",
};

export default async function ForwardsPage() {
  const actor = await requireAdmin();
  if (!canManageMail(actor)) notFound();
  if (!mailConfigured()) return <MailServerProblem configured={false} />;
  let rows;
  try {
    rows = await listForwards();
  } catch (error) {
    // The JMAP client already logged the step and the status; anything else is named, never dumped.
    console.error("[email] page failed", { name: error instanceof Error ? error.name : typeof error });
    return <MailServerProblem configured />;
  }
  return (
    <>
      <PageHeader crumbs={[{ label: "E-mail", href: "/email" }]} title="Redirecionamentos" count={rows.length} className="mb-4" />
      <ForwardList rows={rows} domain={MAIL_DOMAINS[0]} actions={<NewForwardButton domain={MAIL_DOMAINS[0]} />} />
    </>
  );
}
