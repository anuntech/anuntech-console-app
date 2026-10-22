import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { rounded, space, usePalette } from "@/lib/theme";
import { Button } from "./button";
import { Field } from "./field";
import { Sheet } from "./sheet";
import { Card, Notice } from "./surface";
import { Text } from "./text";

export type BankCardData = Awaited<ReturnType<typeof api.hours.banks>>["banks"][number];

const TZ = "America/Sao_Paulo";
const hours = (minutes: number) => `${String(Math.round((minutes / 60) * 10) / 10).replace(".", ",")} h`;
const monthName = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
/** "10/10/2026 às 14:30", as the web writes it. */
const dateTime = (iso: string) => `${day.format(new Date(iso))} às ${time.format(new Date(iso))}`;
/** A civil date (YYYY-MM-DD) as "10/10", never shifted by time zone. */
const shortDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** A sent report: when, until when it can be contested, and "Contestar" for an Administrador. */
function ReportLine({
  month,
  sentAt,
  contestedAt,
  contestUntil,
  canContest,
  onContest,
}: {
  month: string;
  sentAt: string;
  contestedAt: string | null;
  contestUntil: string | null;
  canContest: boolean;
  onContest: () => void;
}) {
  const palette = usePalette();
  const windowOpen = !contestedAt && (!contestUntil || new Date(contestUntil) >= new Date());
  const status = contestedAt
    ? ` Contestado em ${dateTime(contestedAt)}.`
    : contestUntil
      ? windowOpen
        ? ` Pode ser contestado até ${day.format(new Date(contestUntil))}.`
        : " Aprovado: o prazo de contestação terminou."
      : "";
  return (
    <View style={{ backgroundColor: palette.secondary, ...rounded(12), paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs }}>
      <Text variant="caption" tone="muted">
        Relatório de {monthName(month)} enviado em {dateTime(sentAt)}.{status}
      </Text>
      {canContest && windowOpen ? <Button title="Contestar" variant="plain" size="small" onPress={onContest} /> : null}
    </View>
  );
}

/**
 * The month's hours bank (SUP 4.1 to 4.7), as the web's HoursBankCard: what
 * was used of what is included, the latest lines, the hours approved beyond
 * it and the monthly report. An Administrador approves hours beyond the bank
 * and contests a report (hours.approveOverage, hours.contestReport); a
 * Membro only reads.
 */
export function HoursBankCard({ bank, showCompany }: { bank: BankCardData; showCompany: boolean }) {
  const palette = usePalette();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [contesting, setContesting] = useState<string | null>(null);
  const [amount, setAmount] = useState(bank.overageApprovedMinutes ? String(bank.overageApprovedMinutes / 60).replace(".", ",") : "");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const percent = bank.includedMinutes ? Math.round((bank.usedMinutes / bank.includedMinutes) * 100) : 0;
  const alert = percent >= bank.alertPercent;
  const approver = bank.viewer === "approver";
  const refresh = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ["overview"] }), queryClient.invalidateQueries({ queryKey: ["hours"] })]);
  const approve = useMutation({
    mutationFn: () => api.hours.approveOverage({ companyId: bank.companyId, hours: amount.trim() }),
    onSuccess: async ({ message }) => {
      haptic.success();
      setApproving(false);
      setDone(message);
      await refresh();
    },
    onError: () => haptic.error(),
  });
  const contest = useMutation({
    mutationFn: (month: string) => api.hours.contestReport({ companyId: bank.companyId, month, note: note.trim() }),
    onSuccess: async ({ message }) => {
      haptic.success();
      setContesting(null);
      setNote("");
      setDone(message);
      await refresh();
    },
    onError: () => haptic.error(),
  });
  const bar = percent >= 100 ? palette.destructive : alert ? palette.warning : palette.primary;
  const usage = `${monthName(bank.month)}: ${hours(bank.usedMinutes)} de ${hours(bank.includedMinutes)} (${percent}%)`;
  const openContest = (month: string) => {
    contest.reset();
    setContesting(month);
  };
  return (
    <Card raised={alert} tone={alert ? "warning" : undefined}>
      <View style={{ gap: 2 }}>
        <Text variant="headline" accessibilityRole="header">
          {showCompany ? `Banco de horas de ${bank.company}` : "Banco de horas"}
        </Text>
        <Text variant="subhead" tone="muted">
          {usage}
        </Text>
      </View>
      <View style={{ gap: space.xs }}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Uso do banco de horas"
          accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100) }}
          style={{ height: 8, ...rounded(999), backgroundColor: palette.fill, overflow: "hidden" }}
        >
          <View style={{ width: `${Math.min(percent, 100)}%`, height: 8, ...rounded(999), backgroundColor: bar }} />
        </View>
        {bank.overageApprovedMinutes > 0 ? (
          <Text variant="caption" tone="muted">
            {`Até ${hours(bank.overageApprovedMinutes)} além do banco aprovadas.`}
          </Text>
        ) : null}
        {alert ? (
          <Text variant="caption" tone="muted">
            Fora a correção de um defeito crítico, nada passa do banco sem a aprovação de um Administrador da empresa.
          </Text>
        ) : null}
      </View>
      {bank.entries.length > 0 ? (
        <View style={{ gap: space.sm }}>
          {bank.entries.map((e) => {
            const detail = `${e.ticket ?? e.author}${e.kind === "warranty" ? " · garantia, fora do banco" : e.kind === "critical" ? " · defeito crítico" : ""}`;
            return (
              <View
                key={e.id}
                accessible
                accessibilityLabel={`${shortDay(e.workedOn)}, ${e.note}, ${detail}, ${hours(e.minutes)}`}
                style={{ flexDirection: "row", gap: space.md }}
              >
                <Text variant="caption" tone="muted" style={{ width: 40, fontVariant: ["tabular-nums"] }}>
                  {shortDay(e.workedOn)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="subhead" numberOfLines={1}>
                    {e.note}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {detail}
                  </Text>
                </View>
                <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
                  {hours(e.minutes)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      {done ? <Notice kind="success">{done}</Notice> : null}
      {approver && alert ? (
        <Button
          title="Aprovar horas além do banco"
          variant="secondary"
          size="small"
          onPress={() => {
            approve.reset();
            setApproving(true);
          }}
        />
      ) : null}
      {bank.previous?.reportSentAt ? (
        <ReportLine
          month={bank.previous.month}
          sentAt={bank.previous.reportSentAt}
          contestedAt={bank.previous.contestedAt}
          contestUntil={bank.previous.contestUntil}
          canContest={approver}
          onContest={() => openContest(bank.previous!.month)}
        />
      ) : null}
      {bank.reportSentAt ? (
        <ReportLine
          month={bank.month}
          sentAt={bank.reportSentAt}
          contestedAt={bank.contestedAt}
          contestUntil={bank.contestUntil}
          canContest={approver}
          onContest={() => openContest(bank.month)}
        />
      ) : null}
      <Sheet
        visible={approving}
        onClose={() => setApproving(false)}
        title="Aprovar horas além do banco"
        subtitle={showCompany ? bank.company : usage}
        busy={approve.isPending}
      >
        <Field
          label="Até quantas horas além do banco neste mês?"
          hint="O excedente é cobrado pelo valor por hora do contrato."
          placeholder="Ex.: 5"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          maxLength={10}
          editable={!approve.isPending}
          autoFocus
        />
        {approve.error ? <Notice kind="error">{errorMessage(approve.error)}</Notice> : null}
        <View style={{ gap: space.xs }}>
          <Button
            title={approve.isPending ? "Aprovando…" : "Aprovar"}
            busy={approve.isPending}
            disabled={!amount.trim()}
            onPress={() => {
              haptic.medium();
              approve.mutate();
            }}
          />
          <Button title="Cancelar" variant="plain" disabled={approve.isPending} onPress={() => setApproving(false)} />
        </View>
      </Sheet>
      <Sheet
        visible={!!contesting}
        onClose={() => setContesting(null)}
        title="Contestar relatório"
        subtitle={contesting ? `Relatório de ${monthName(contesting)}` : undefined}
        busy={contest.isPending}
      >
        <Field
          label="O que não confere"
          placeholder="O que não confere."
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={2000}
          editable={!contest.isPending}
          style={{ minHeight: 120, textAlignVertical: "top" }}
        />
        {contest.error ? <Notice kind="error">{errorMessage(contest.error)}</Notice> : null}
        <View style={{ gap: space.xs }}>
          <Button
            title={contest.isPending ? "Enviando…" : "Contestar relatório"}
            busy={contest.isPending}
            disabled={!note.trim()}
            onPress={() => {
              if (!contesting) return;
              haptic.medium();
              contest.mutate(contesting);
            }}
          />
          <Button title="Cancelar" variant="plain" disabled={contest.isPending} onPress={() => setContesting(null)} />
        </View>
      </Sheet>
    </Card>
  );
}
