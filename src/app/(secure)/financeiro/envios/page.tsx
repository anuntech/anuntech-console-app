import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheckIcon,
  Clock3Icon,
  MailIcon,
  MessageCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { billingNotices, companies, invoices } from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import {
  noticeChannelLabels,
  noticeKindLabel,
} from "@/lib/billing/billing-notice-rules";
import { dateTimeLabel } from "@/lib/format";
import { companyDisplayName } from "@/lib/companies/display-name";
import { ListCard } from "@/components/console/list-view";
import { EmptyState, PageHeader } from "@/components/console/page-header";
import { NoticeStatusBadge } from "@/components/financeiro/invoice-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
export const metadata: Metadata = {
  title: "Envios de cobrança",
  description:
    "Os avisos de cobrança enviados por e-mail e WhatsApp, com a entrega de cada um.",
};

const ACTIVE = ["waiting", "pending", "sending", "accepted"];
const REVIEW = ["failed", "uncertain", "expired"];

/** A delivery count. Only "to review" takes colour, and only when it has something. */
function Stat({
  label,
  value,
  icon,
  attention = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  attention?: boolean;
}) {
  const alert = attention && value > 0;
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card px-4 pt-3.5 pb-4 shadow-card">
      <span className="flex items-center justify-between gap-3">
        <span className="truncate text-label text-muted-foreground">{label}</span>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-3.5",
            alert ? "bg-warning-soft text-warning" : "bg-secondary text-muted-foreground",
          )}
        >
          {icon}
        </span>
      </span>
      <span className={cn("text-title-lg tabular-nums", alert ? "text-warning" : "text-foreground")}>{value}</span>
    </div>
  );
}

export default async function BillingDeliveries() {
  await requireAdmin();
  const rows = await db
    .select({
      notice: billingNotices,
      company: companies.name,
      document: companies.document,
      description: invoices.description,
    })
    .from(billingNotices)
    .innerJoin(invoices, eq(invoices.id, billingNotices.invoiceId))
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .orderBy(desc(billingNotices.createdAt))
    .limit(200);
  const by = (statuses: string[]) =>
    rows.filter(({ notice }) => statuses.includes(notice.status)).length;
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Financeiro", href: "/financeiro" }]}
        title="Envios de cobrança"
        count={rows.length}
        className="mb-4"
      />
      <div className="stagger mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 max-sm:[&>:last-child]:col-span-2">
        <Stat label="Entregues" value={by(["delivered"])} icon={<CircleCheckIcon />} />
        <Stat label="Em andamento" value={by(ACTIVE)} icon={<Clock3Icon />} />
        <Stat
          label="Precisam de revisão"
          value={by(REVIEW)}
          icon={<TriangleAlertIcon />}
          attention
        />
      </div>
      <ListCard
        fill
        empty={!rows.length}
        label="Histórico de envios"
        footer={
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            {rows.length === 200 && "Exibindo os 200 avisos mais recentes. "}
            Entrega de e-mail confirma o recebimento pelo servidor, não a leitura.
          </p>
        }
      >
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Cliente e fatura</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Aviso</TableHead>
                <TableHead>Entrega</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ notice, company, document, description }) => (
                <TableRow key={notice.id}>
                  <TableCell className="max-w-[24rem] py-3 pl-4">
                    <Link
                      href={`/financeiro/${notice.invoiceId}`}
                      className="group block min-w-0"
                    >
                      <span className="block truncate font-medium text-foreground group-hover:text-primary">
                        {companyDisplayName(company, document)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {description}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      {notice.channel === "email" ? (
                        <MailIcon className="size-3.5 text-muted-foreground" />
                      ) : (
                        <MessageCircleIcon className="size-3.5 text-muted-foreground" />
                      )}
                      {noticeChannelLabels[notice.channel]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-foreground">
                      {noticeKindLabel(notice.kind)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {dateTimeLabel(notice.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <NoticeStatusBadge status={notice.status} />
                    {notice.error && (
                      <span className="mt-1 block max-w-[24rem] text-xs text-muted-foreground">
                        {notice.error}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            art="faturas"
            title="Nenhum aviso enviado"
            description="As mensagens aparecem aqui depois que uma cobrança é publicada."
          />
        )}
      </ListCard>
    </>
  );
}
