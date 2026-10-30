import type { Metadata } from "next";
import { CheckCircle2Icon, InboxIcon, MousePointerClickIcon, TimerIcon } from "lucide-react";
import { requireAdmin } from "@/lib/access/access";
import { saoPauloDate } from "@/lib/dates";
import { decisionTally, openDecisions, recentDecisions } from "@/lib/decisions/decisions";
import { DECISION_KINDS, LEVEL_LABELS, decisionKinds } from "@/lib/decisions/decision-rules";
import { stuckEvents } from "@/lib/events/events";
import { PageHeader, SectionTitle } from "@/components/console/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { DecisionQueue, type QueueItem } from "@/components/piloto/decision-queue";
import { DecisionHistory, type HistoryItem } from "@/components/piloto/decision-history";
import { KpiTile } from "@/components/painel/dashboard-parts";

export const metadata: Metadata = { title: "Piloto automático", description: "O que o Console preparou e espera a aprovação da equipe." };

export default async function Piloto() {
  await requireAdmin();
  const today = saoPauloDate();
  const monthStart = new Date(`${today.slice(0, 8)}01T00:00:00-03:00`);
  const [open, recent, tally, stuck] = await Promise.all([openDecisions(), recentDecisions(), decisionTally(monthStart), stuckEvents()]);
  const queue: QueueItem[] = open.map(({ decision, company }) => ({
    id: decision.id,
    kind: decision.kind,
    title: decision.title,
    reason: decision.reason,
    company,
    companyId: decision.companyId,
    details: decision.details,
    steps: decision.steps,
    draft: decision.draft,
    createdAt: decision.createdAt.toISOString(),
    expiresAt: decision.expiresAt.toISOString(),
  }));
  const history: HistoryItem[] = recent.map(({ decision, company }) => ({
    id: decision.id,
    title: decision.title,
    company,
    status: decision.status,
    resolution: decision.resolution,
    dismissReason: decision.dismissReason,
    decidedAt: decision.decidedAt?.toISOString() ?? null,
  }));
  const finished = tally.queue + tally.elsewhere + tally.mixed;
  return (
    <>
      <PageHeader title="Piloto automático" count={queue.length} className="mb-4" />
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        O Console prepara os próximos passos quando algo acontece: um orçamento aceito, um contrato assinado, uma fatura vencida. Nada sai sozinho: cada passo roda no clique de alguém da equipe, pela mesma tela de sempre.
      </p>

      {stuck.length > 0 && (
        <p className="mb-6 rounded-lg border border-warning-edge bg-warning-soft px-3 py-2 text-sm text-warning">
          {stuck.length === 1 ? "1 evento parou" : `${stuck.length} eventos pararam`} depois de várias tentativas. O último erro: {stuck[0].lastError ?? "sem detalhe"}.
        </p>
      )}

      <div className="stagger mb-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile icon={<InboxIcon />} tone={queue.length ? "warning" : "default"} label="Para aprovar" value={queue.length} detail="Decisões abertas agora" />
        <KpiTile icon={<CheckCircle2Icon />} tone="good" label="Resolvidas no mês" value={finished} detail={`${tally.queue} pela fila, ${tally.elsewhere + tally.mixed} pelas telas`} />
        <KpiTile icon={<MousePointerClickIcon />} label="Cliques por decisão" value={tally.touchesPerDecision ?? "–"} detail="Média das resolvidas no mês" />
        <KpiTile
          icon={<TimerIcon />}
          label="Tempo até resolver"
          value={tally.medianHours === null ? "–" : tally.medianHours < 24 ? `${tally.medianHours} h` : `${Math.round(tally.medianHours / 24)} d`}
          detail={`Mediana no mês. ${tally.dismissed} dispensadas, ${tally.expired} vencidas`}
        />
      </div>

      <section className="mb-10 flex flex-col gap-3">
        <SectionTitle title="Para aprovar" />
        <DecisionQueue items={queue} />
      </section>

      <section className="mb-10 flex flex-col gap-3">
        <SectionTitle title="O que o Console faz sozinho" description="Dinheiro, contrato com o cliente e suspensão ficam sempre em Prepara e pede aprovação." />
        <Card className="py-2">
          <CardContent className="px-0">
            <ul className="m-0 grid list-none p-0">
              {decisionKinds.map((kind) => (
                <li key={kind} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t px-6 py-3 text-sm first:border-t-0">
                  <span className="min-w-0">
                    <span className="block text-foreground">{DECISION_KINDS[kind].label}</span>
                    <span className="block text-xs text-muted-foreground">{DECISION_KINDS[kind].why}</span>
                  </span>
                  <span className="text-muted-foreground">{LEVEL_LABELS[DECISION_KINDS[kind].level]}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle title="Resolvidas há pouco" />
          <DecisionHistory items={history} />
        </section>
      )}
    </>
  );
}
