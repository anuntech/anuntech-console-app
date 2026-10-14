"use client";
import Link from "next/link";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/console/page-header";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { currency, dateLabel, dateTimeLabel } from "@/lib/format";
import { approveOverage, contestHoursReport, sendBankAlert, sendHoursReport } from "@/lib/service-terms/hours-actions";
import type { BankCard } from "@/lib/service-terms/hours-bank";

const hours = (minutes: number) => {
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${String(h).replace(".", ",")} h`;
};
const monthName = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

/** A sent report and what the client can still do about it. */
function ReportLine({
  companyId,
  month,
  sentAt,
  contestedAt,
  contestUntil,
  canContest,
}: {
  companyId: string;
  month: string;
  sentAt: string;
  contestedAt: string | null;
  contestUntil: string | null;
  canContest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const windowOpen = !contestedAt && (!contestUntil || new Date(contestUntil) >= new Date());
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
      Relatório de {monthName(month)} enviado em {dateTimeLabel(sentAt)}.
      {contestedAt
        ? ` Contestado em ${dateTimeLabel(contestedAt)}.`
        : contestUntil
          ? windowOpen
            ? ` Pode ser contestado até ${dateLabel(new Date(contestUntil))}.`
            : " Aprovado: o prazo de contestação terminou."
          : ""}
      {canContest &&
        windowOpen &&
        (open ? (
          <ServerForm action={contestHoursReport} onSuccess={() => setOpen(false)} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="month" value={month} />
            <FormError />
            <Textarea name="note" required rows={3} placeholder="O que não confere." />
            <SubmitButton pendingLabel="Enviando…" className="self-start">
              Contestar relatório
            </SubmitButton>
          </ServerForm>
        ) : (
          <Button type="button" variant="link" size="sm" className="h-auto p-0 pl-1 text-xs" onClick={() => setOpen(true)}>
            Contestar
          </Button>
        ))}
    </div>
  );
}

/**
 * The month's hours bank (SUP 4.1 to 4.7): what was used of what is
 * included, the approval of hours beyond it and the monthly report. The
 * client's Administrador approves and contests; the team sends the report
 * and the 80% notice by click. Last month stays here while its report is
 * pending or can still be contested.
 */
export function HoursBankCard({
  bank,
  viewer,
  showCompany = false,
  overages = [],
  reports = [],
}: {
  bank: BankCard;
  viewer: "team" | "approver" | "member";
  showCompany?: boolean;
  /** Team: closed months' hours beyond the bank, ready to bill (the contest window closed). */
  overages?: { month: string; minutes: number; priceCents: number; amountCents: number; href: string }[];
  /** Team: closed months with work logged and no final report yet. */
  reports?: { month: string; again: boolean }[];
}) {
  const [approving, setApproving] = useState(false);
  const percent = bank.includedMinutes ? Math.round((bank.usedMinutes / bank.includedMinutes) * 100) : 0;
  const alert = percent >= bank.alertPercent;
  const prev = bank.previous;
  return (
    <Card className="gap-4 py-5">
      <CardHeader>
        <SectionTitle
          title={showCompany ? `Banco de horas · ${bank.companyName}` : "Banco de horas"}
          description={`${monthName(bank.month)}: ${hours(bank.usedMinutes)} de ${hours(bank.includedMinutes)}`}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div
            className="h-2 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label="Uso do banco de horas"
            aria-valuenow={Math.min(percent, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={cn("h-full rounded-full", percent >= 100 ? "bg-destructive" : alert ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(percent, 100)}%` }} />
          </div>
          <p className="m-0 mt-1.5 text-xs text-muted-foreground">
            {percent}% usado
            {bank.overageApprovedMinutes > 0 && ` · até ${hours(bank.overageApprovedMinutes)} além do banco aprovadas`}
          </p>
          {alert && viewer !== "team" && (
            <p className="m-0 mt-1 text-xs text-muted-foreground">
              Fora a correção de um defeito crítico, nada passa do banco sem a aprovação de um Administrador da empresa.
            </p>
          )}
        </div>

        {bank.entries.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {bank.entries.slice(0, 5).map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">{dateLabel(e.workedOn).slice(0, 5)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">{e.note}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {e.ticket ?? e.author}
                    {e.kind === "warranty" ? " · garantia, fora do banco" : e.kind === "critical" ? " · defeito crítico" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-foreground tabular-nums">{hours(e.minutes)}</span>
              </li>
            ))}
          </ul>
        )}

        {viewer === "approver" &&
          (approving ? (
            <ServerForm action={approveOverage} onSuccess={() => setApproving(false)} className="flex flex-col gap-2">
              <input type="hidden" name="companyId" value={bank.companyId} />
              <FormError />
              <label className="text-xs font-medium text-foreground" htmlFor={`bank-overage-${bank.companyId}`}>
                Até quantas horas além do banco neste mês?
              </label>
              <div className="flex gap-2">
                <Input
                  id={`bank-overage-${bank.companyId}`}
                  name="hours"
                  inputMode="decimal"
                  required
                  placeholder="Ex.: 5"
                  defaultValue={bank.overageApprovedMinutes ? String(bank.overageApprovedMinutes / 60).replace(".", ",") : ""}
                />
                <SubmitButton pendingLabel="Aprovando…">Aprovar</SubmitButton>
              </div>
              <p className="m-0 text-xs text-muted-foreground">O excedente é cobrado pelo valor por hora do contrato.</p>
            </ServerForm>
          ) : (
            alert && (
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setApproving(true)}>
                Aprovar horas além do banco
              </Button>
            )
          ))}

        {prev?.reportSentAt && (
          <ReportLine
            companyId={bank.companyId}
            month={prev.month}
            sentAt={prev.reportSentAt}
            contestedAt={prev.contestedAt}
            contestUntil={prev.contestUntil}
            canContest={viewer === "approver"}
          />
        )}
        {bank.reportSentAt && (
          <ReportLine
            companyId={bank.companyId}
            month={bank.month}
            sentAt={bank.reportSentAt}
            contestedAt={bank.contestedAt}
            contestUntil={bank.contestUntil}
            canContest={viewer === "approver"}
          />
        )}

        {viewer === "team" &&
          overages.map((overage) => (
            <div key={overage.month} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-field/60 px-3 py-2 text-sm">
              <span className="min-w-0">
                Excedente de {monthName(overage.month)}: {hours(overage.minutes)} × {currency(overage.priceCents)} ={" "}
                <strong className="font-semibold">{currency(overage.amountCents)}</strong>
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href={overage.href}>Preparar cobrança</Link>
              </Button>
            </div>
          ))}
        {viewer === "team" && (
          <div className="flex flex-wrap gap-2">
            {prev && !prev.final && !reports.some((report) => report.month === prev.month) && (
              <ServerForm action={sendHoursReport}>
                <input type="hidden" name="companyId" value={bank.companyId} />
                <input type="hidden" name="month" value={prev.month} />
                <SubmitButton size="sm" pendingLabel="Enviando…">
                  {prev.reportSentAt ? `Reenviar relatório final de ${monthName(prev.month)}` : `Enviar relatório de ${monthName(prev.month)}`}
                </SubmitButton>
              </ServerForm>
            )}
            {reports.map((report) => (
              <ServerForm key={report.month} action={sendHoursReport}>
                <input type="hidden" name="companyId" value={bank.companyId} />
                <input type="hidden" name="month" value={report.month} />
                <SubmitButton size="sm" pendingLabel="Enviando…">
                  {report.again ? `Reenviar relatório final de ${monthName(report.month)}` : `Enviar relatório de ${monthName(report.month)}`}
                </SubmitButton>
              </ServerForm>
            ))}
            <ServerForm action={sendHoursReport}>
              <input type="hidden" name="companyId" value={bank.companyId} />
              <input type="hidden" name="month" value={bank.month} />
              <SubmitButton variant="outline" size="sm" pendingLabel="Enviando…">
                {bank.reportSentAt ? `Reenviar relatório de ${monthName(bank.month)}` : `Enviar relatório parcial de ${monthName(bank.month)}`}
              </SubmitButton>
            </ServerForm>
            {alert && !bank.alertSentAt && (
              <ServerForm action={sendBankAlert}>
                <input type="hidden" name="companyId" value={bank.companyId} />
                <SubmitButton variant="outline" size="sm" pendingLabel="Avisando…">
                  Avisar o cliente dos {bank.alertPercent}%
                </SubmitButton>
              </ServerForm>
            )}
            {bank.alertSentAt && (
              <p className="m-0 self-center text-xs text-muted-foreground">{`Aviso dos ${bank.alertPercent}% enviado em ${dateLabel(new Date(bank.alertSentAt))}.`}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
