import "server-only";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { settingsEnvironment } from "@/lib/access/environment";
import { dateTimeLabel } from "@/lib/format";
import { noticeHistory } from "@/lib/notifications/notice-history";
import {
  NOTICE_HISTORY_PAGE_SIZE,
  noticeActionLabel,
  noticeRecipient,
  noticeStatusLabel,
  noticeTone,
  type NoticeTone,
} from "@/lib/notifications/notice-history-view";
import {
  getNoticePreferences,
  noticeEmails,
  noticePhones,
  type NotificationTopic,
} from "@/lib/notifications/notification-preferences";
import { ticketNotificationsEnabled } from "@/lib/notifications/notification-settings";
import { saveNotificationPreferences } from "@/lib/companies/company-settings-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, SectionTitle } from "@/components/console/page-header";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { ContactsField, TicketNoticesSwitch } from "./notification-forms";
import { HelpLink } from "@/components/console/help-link";
import type { ReactNode } from "react";

const toneClasses: Record<NoticeTone, string> = {
  good: "bg-success-soft text-success",
  info: "bg-accent text-primary",
  danger: "bg-destructive-soft text-destructive",
  attention: "bg-warning-soft text-warning",
  neutral: "bg-secondary text-muted-foreground",
};

async function TopicCard({
  companyId,
  topic,
  title,
  description,
}: {
  companyId: string | null;
  topic: NotificationTopic;
  title: string;
  description?: ReactNode;
}) {
  const preferences = await getNoticePreferences(companyId, topic);
  return (
    <Card>
      <CardHeader>
        <SectionTitle title={title} description={description} />
      </CardHeader>
      <ServerForm action={saveNotificationPreferences} className="contents">
        <input type="hidden" name="companyId" value={companyId || ""} />
        <input type="hidden" name="topic" value={topic} />
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <div className="grid gap-5 sm:grid-cols-2">
            <ContactsField kind="email" values={noticeEmails(preferences)} />
            <ContactsField kind="phone" values={noticePhones(preferences)} />
          </div>
          <fieldset className="flex flex-wrap gap-6">
            <legend className="mb-1.5 text-sm font-medium text-foreground">Receber por</legend>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox name="emailEnabled" value="yes" defaultChecked={preferences.emailEnabled} />
              E-mail
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                name="whatsappEnabled"
                value="yes"
                defaultChecked={preferences.whatsappEnabled}
              />
              WhatsApp
            </label>
          </fieldset>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}

export async function NotificationsSection({
  page: requestedPage,
}: {
  page?: string | string[];
}) {
  const { actor, companyId } = await settingsEnvironment();
  const [enabled, { rows, total, page, pageCount }] = await Promise.all([
    actor.admin ? ticketNotificationsEnabled() : Promise.resolve(false),
    noticeHistory(companyId, requestedPage),
  ]);
  return (
    <>
      {actor.admin && (
        <Card>
          <CardHeader>
            <SectionTitle title="Equipe Anuntech" />
          </CardHeader>
          <CardContent>
            <TicketNoticesSwitch enabled={enabled} />
          </CardContent>
        </Card>
      )}
      {companyId && (
        <TopicCard
          companyId={companyId}
          topic="billing"
          title="Financeiro"
          description={<HelpLink slug="avisos-de-cobranca">Quando cada aviso chega</HelpLink>}
        />
      )}
      <TopicCard
        companyId={companyId}
        topic="tickets"
        title="Chamados"
      />
      <Card>
        <CardHeader>
          <SectionTitle
            title={
              <span className="flex items-center gap-2">
                Histórico de envios
                {/* An empty history says so below; a "0" beside the title would say it twice. */}
                {total > 0 && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground">
                    {total}
                  </span>
                )}
              </span>
            }
          />
        </CardHeader>
        <CardContent className="px-0">
          {rows.length ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Movimentação</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="pr-6">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-notice-id={row.id}>
                    <TableCell className="max-w-[20rem] pl-6">
                      <Link
                        href={row.href}
                        className="block truncate font-medium text-foreground hover:text-primary"
                      >
                        {row.subject}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {noticeActionLabel(row.action)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[16rem]">
                      {/* An address or a number already says the channel; the channel's name only stands in for a missing one. */}
                      <span className="block truncate text-foreground">
                        {noticeRecipient(row.channel, row.destination)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                          toneClasses[noticeTone(row.status)],
                        )}
                      >
                        {noticeStatusLabel(row.status)}
                      </span>
                      {row.error && (
                        <span className="mt-1 block max-w-[20rem] text-xs text-muted-foreground">
                          {row.error}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 whitespace-nowrap text-muted-foreground">
                      {dateTimeLabel(new Date(row.created_at))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="Nenhum aviso registrado"
              description="Os próximos envios aparecem aqui."
              className="py-10"
            />
          )}
        </CardContent>
        {pageCount > 1 && (
          <CardFooter className="justify-between border-t text-xs text-muted-foreground">
            <span className="tabular-nums">
              {(page - 1) * NOTICE_HISTORY_PAGE_SIZE + 1}–{Math.min(page * NOTICE_HISTORY_PAGE_SIZE, total)} de {total}
            </span>
            <span className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? (
                  <Link href={`/configuracoes/notificacoes?page=${page - 1}`} scroll={false}>
                    <ChevronLeftIcon />
                  </Link>
                ) : (
                  <ChevronLeftIcon />
                )}
              </Button>
              <span className="px-2 tabular-nums">
                {page} / {pageCount}
              </span>
              <Button variant="outline" size="icon-sm" aria-label="Próxima página" disabled={page >= pageCount} asChild={page < pageCount}>
                {page < pageCount ? (
                  <Link href={`/configuracoes/notificacoes?page=${page + 1}`} scroll={false}>
                    <ChevronRightIcon />
                  </Link>
                ) : (
                  <ChevronRightIcon />
                )}
              </Button>
            </span>
          </CardFooter>
        )}
      </Card>
    </>
  );
}
