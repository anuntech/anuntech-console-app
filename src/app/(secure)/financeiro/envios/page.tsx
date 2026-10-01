import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheckIcon,
  Clock3Icon,
  MailIcon,
  MessageCircleIcon,
  SendIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { cn } from "cn";
import { db } from "@/lib/db";
import { billingNotices, companies, invoices } from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import {
  noticeChannelLabels,
  noticeKindLabel,
} from "@/lib/billing/billing-notice-rules";
import { dateTimeLabel } from "@/lib/format";
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

function Stat({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-card">
      <span>
        <span className="block text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block text-xl font-semibold tracking-[-0.02em] tabular-nums text-foreground">
          {value}
        </span>
      </span>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
          tone === "success" && "bg-success-soft text-success",
          tone === "warning" && "bg-warning-soft text-warning",
          tone === "default" && "bg-accent text-primary",
        )}
      >
        {icon}
      </span>
    </div>
  );
}

export default async function BillingDeliveries() {
  await requireAdmin();
  const rows = await db
    .select({
      notice: billingNotices,
      company: companies.name,
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
        crumbs={[{ label: "Financeiro", href: "/financeiro" }, { label: "Envios" }]}
        title="Envios de cobrança"
        count={rows.length}
        className="mb-4"
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Entregues"
          value={by(["delivered"])}
          icon={<CircleCheckIcon />}
          tone="success"
        />
        <Stat label="Em andamento" value={by(ACTIVE)} icon={<Clock3Icon />} />
        <Stat
          label="Precisam de revisão"
          value={by(REVIEW)}
          icon={<TriangleAlertIcon />}
          tone="warning"
        />
      </div>
      <ListCard
        fill
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
              {rows.map(({ notice, company, description }) => (
                <TableRow key={notice.id}>
                  <TableCell className="max-w-[24rem] py-3 pl-4">
                    <Link
                      href={`/financeiro/${notice.invoiceId}`}
                      className="group block min-w-0"
                    >
                      <span className="block truncate font-medium text-foreground group-hover:text-primary">
                        {company}
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
            icon={<SendIcon />}
            title="Nenhum aviso enviado"
            description="As mensagens aparecem aqui depois que uma cobrança é publicada."
          />
        )}
      </ListCard>
    </>
  );
}
