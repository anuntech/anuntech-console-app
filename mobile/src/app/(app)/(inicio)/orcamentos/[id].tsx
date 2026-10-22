import { useRef, useState, type ComponentRef } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Card, Notice } from "@/components/surface";
import { Pill } from "@/components/pill";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { StatusTile } from "@/components/tile";
import { ConsentRow } from "@/components/consent-row";
import { DocumentFacts } from "@/components/document-facts";
import { Field } from "@/components/field";
import { Sheet } from "@/components/sheet";
import { PdfRow } from "@/components/pdf-button";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { api, errorMessage } from "@/lib/api";
import { civilDate, money, when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { space } from "@/lib/theme";
import { quoteTone } from "@/lib/tones";

type Detail = Awaited<ReturnType<typeof api.quotes.get>>;
type Decision = "accept" | "decline";

const hours = (min: number, max: number) => (min === max ? `${min} h` : `${min} a ${max} h`);
/** "P1-01": a task's address inside the proposal, as the web and the PDF number it. */
const taskCode = (phase: number, task: number) => `P${phase + 1}-${String(task + 1).padStart(2, "0")}`;

/** One phase of the proposal: its name and hours, what it is for, and its tasks numbered as in the PDF. */
function Phase({ phase, index }: { phase: Detail["phases"][number]; index: number }) {
  const tasks = phase.tasks.length ? `${phase.tasks.length} ${phase.tasks.length === 1 ? "tarefa" : "tarefas"} · ` : "";
  const count = `${tasks}${hours(phase.hoursMin, phase.hoursMax)}`;
  return (
    <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm }}>
      <View accessible accessibilityRole="header" accessibilityLabel={`${phase.name}, ${count}`} style={{ gap: 2 }}>
        <Text variant="headline">{phase.name}</Text>
        <Text variant="caption" tone="muted" style={{ fontVariant: ["tabular-nums"] }}>
          {count}
        </Text>
      </View>
      {phase.description.trim() ? (
        <Text variant="subhead" tone="muted" selectable>
          {phase.description.trim()}
        </Text>
      ) : null}
      {phase.tasks.length ? (
        <View style={{ gap: space.sm, marginTop: space.xs }}>
          {phase.tasks.map((task, taskIndex) => (
            <View
              key={taskIndex}
              accessible
              accessibilityLabel={`${taskCode(index, taskIndex)}, ${task}`}
              style={{ flexDirection: "row", gap: space.sm }}
            >
              <Text variant="caption" tone="muted" style={{ width: 48, paddingTop: 1, fontVariant: ["tabular-nums"] }}>
                {taskCode(index, taskIndex)}
              </Text>
              <Text variant="subhead" style={{ flex: 1 }}>
                {task}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** One quote: the proposal as it was sent, the answer if there is one, and accepting or declining it (quotes.get, quotes.answer). */
export default function Quote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useTabBarSpace();
  const queryClient = useQueryClient();
  const me = useMe();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const quote = useQuery({ queryKey: ["quote", id], queryFn: () => api.quotes.get({ id }) });
  const loading = useDelayed(quote.isPending);
  const [consent, setConsent] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [answered, setAnswered] = useState<string | null>(null);
  const answer = useMutation({
    mutationFn: ({ decision, note: text }: { decision: Decision; note: string }) =>
      api.quotes.answer({ id, decision, note: text.trim(), consent: decision === "accept" }),
    onSuccess: async ({ message }) => {
      haptic.success();
      setAnswered(message);
      setDeclining(false);
      setConsent(false);
      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quote", id] }),
        queryClient.invalidateQueries({ queryKey: ["quotes"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
    },
    onError: () => haptic.error(),
  });
  const q = quote.data;
  const signer = me.data ? me.data.name.trim() || me.data.email : "";
  const staff = !!me.data?.staff;
  const pending = answer.isPending;
  const failed = answer.error ? answer.variables?.decision : null;
  const upfrontCents = q ? Math.round((q.totalCents * q.upfrontPercent) / 100) : 0;

  /** What the answer looks like when there is nothing to do here: decided, expired or someone else's to answer. */
  const status = !q ? null : q.decision ? (
    <Notice
      kind={q.status === "accepted" ? "success" : "info"}
      title={`${q.status === "accepted" ? "Aceito" : "Recusado"} por ${q.decision.name}`}
    >
      {[
        `${q.decision.party === "client" ? `por ${q.company}` : "registrado pela Anuntech a pedido do cliente"} · ${when(q.decision.at)}`,
        q.decision.note ? `“${q.decision.note}”` : null,
      ]
        .filter(Boolean)
        .join("\n")}
    </Notice>
  ) : q.status === "cancelled" ? (
    <Notice kind="info" title="Cancelada pela Anuntech.">
      Este orçamento não vale mais.
    </Notice>
  ) : q.status !== "sent" ? null : q.expired ? (
    <Notice kind="warning" title="A validade passou sem resposta.">
      {staff ? "Volte para rascunho, ajuste a validade e envie de novo." : "Peça à Anuntech uma nova versão."}
    </Notice>
  ) : q.canAnswer ? (
    <Card raised tone="warning">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <StatusTile icon="text.bubble.fill" tone="attention" />
        <Text variant="subhead" style={{ flex: 1 }}>
          Aguardando a sua resposta. Leia a proposta e responda abaixo.
        </Text>
      </View>
      <Button
        title="Ir para a resposta"
        variant="secondary"
        trailingIcon="arrow.down"
        onPress={() => scroll.current?.scrollToEnd({ animated: true })}
      />
    </Card>
  ) : (
    <Notice kind="info">{staff ? "Aguardando o cliente." : "Só um Administrador da sua empresa aceita ou recusa orçamentos."}</Notice>
  );

  return (
    <ScrollView
      ref={scroll}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={quote.isRefetching} onRefresh={() => void quote.refetch()} />}
    >
      {loading ? (
        <>
          <SkeletonHeader />
          <SkeletonRows count={2} inset={0} />
        </>
      ) : null}
      {quote.error ? <Notice kind="error">{errorMessage(quote.error)}</Notice> : null}
      {q ? (
        <>
          <View style={{ gap: space.sm }}>
            <Pill label={q.statusLabel} tone={quoteTone(q.status)} />
            <Text variant="title" accessibilityRole="header">
              {q.title}
            </Text>
            <Text variant="subhead" tone="muted">
              {q.number} · {q.company}
            </Text>
          </View>
          <View accessible accessibilityLabel={`Total, ${money(q.totalCents)}`} style={{ gap: 2 }}>
            <Text variant="caption" tone="muted">
              Total
            </Text>
            <Text variant="display">{money(q.totalCents)}</Text>
          </View>
          {status}
          <Section indent={space.lg}>
            {q.hoursMax > 0 ? <ListRow title="Estimativa" value={hours(q.hoursMin, q.hoursMax)} /> : null}
            {q.upfrontPercent > 0 ? (
              <ListRow title={`Entrada (${q.upfrontPercent}%)`} value={money(upfrontCents)} />
            ) : null}
            {q.upfrontPercent > 0 && q.upfrontPercent < 100 ? (
              <ListRow title={`Saldo (${100 - q.upfrontPercent}%)`} value={money(q.totalCents - upfrontCents)} />
            ) : null}
            {q.validUntil ? (
              <ListRow
                title="Válido até"
                value={q.expired ? `${civilDate(q.validUntil)} · Expirado` : civilDate(q.validUntil)}
                valueTone={q.expired ? "destructive" : "muted"}
              />
            ) : null}
          </Section>
          {q.summary.trim() ? (
            <Section header="Proposta">
              <Text selectable style={{ padding: 20, lineHeight: 26 }}>
                {q.summary.trim()}
              </Text>
            </Section>
          ) : null}
          {q.phases.length ? (
            <Section header={q.phases.length === 1 ? "Fase" : "Fases"} indent={space.lg}>
              {q.phases.map((phase, index) => (
                <Phase key={index} phase={phase} index={index} />
              ))}
            </Section>
          ) : null}
          {q.notes.trim() ? (
            <Section header="Observações">
              <Text variant="subhead" selectable style={{ padding: 20 }}>
                {q.notes.trim()}
              </Text>
            </Section>
          ) : null}
          {answered || q.canAnswer ? (
            <View style={{ gap: space.block }}>
              {answered ? <Notice kind="success">{answered}</Notice> : null}
              {q.canAnswer ? (
                <Card raised tone="warning" style={{ gap: space.lg }}>
                  <View style={{ gap: 2 }}>
                    <Text variant="headline" accessibilityRole="header">
                      Resposta
                    </Text>
                    <Text variant="subhead" tone="muted">
                      Responda com o seu acesso ao Console.
                    </Text>
                  </View>
                  <ConsentRow
                    testID="accept-consent"
                    checked={consent}
                    onChange={setConsent}
                    disabled={pending || !signer}
                    label={`Li a proposta e aceito o escopo, as condições e o valor de ${money(q.totalCents)}, como ${signer} por ${q.company}.`}
                  >
                    Li a proposta e aceito o escopo, as condições e o valor de <Text variant="label">{money(q.totalCents)}</Text>, como{" "}
                    <Text variant="label">{signer}</Text> por {q.company}.
                  </ConsentRow>
                  {failed === "accept" ? <Notice kind="error">{errorMessage(answer.error)}</Notice> : null}
                  <View style={{ gap: space.xs }}>
                    <Button
                      testID="accept-quote"
                      title={pending && answer.variables?.decision === "accept" ? "Registrando…" : "Aceitar orçamento"}
                      icon="hand.thumbsup.fill"
                      busy={pending && answer.variables?.decision === "accept"}
                      disabled={!consent || !signer || pending}
                      onPress={() => {
                        haptic.medium();
                        answer.mutate({ decision: "accept", note: "" });
                      }}
                    />
                    <Button
                      testID="decline-quote"
                      title="Recusar"
                      variant="plain"
                      disabled={pending}
                      onPress={() => {
                        answer.reset();
                        setDeclining(true);
                      }}
                    />
                  </View>
                  <Text variant="caption" tone="muted">
                    Ficam registrados seu nome, e-mail, data, IP e o hash da proposta.
                  </Text>
                </Card>
              ) : null}
            </View>
          ) : null}
          {q.documentHash ? <DocumentFacts hash={q.documentHash} version={q.version} /> : null}
          <Section>
            <PdfRow path={q.pdfPath} name={`Orçamento ${q.number}.pdf`} title="Ver proposta em PDF" icon="doc.richtext.fill" />
          </Section>
          <Sheet visible={declining} onClose={() => setDeclining(false)} title="Recusar orçamento" subtitle={`${q.number} · ${q.title}`} busy={pending}>
            <Text variant="subhead" tone="muted">
              Se quiser, conte o motivo. A Anuntech recebe a resposta e pode ajustar a proposta.
            </Text>
            <Field
              label="Observação"
              testID="decline-note"
              placeholder="O que pesou na decisão."
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={1000}
              editable={!pending}
              style={{ minHeight: 120, textAlignVertical: "top" }}
            />
            {failed === "decline" ? <Notice kind="error">{errorMessage(answer.error)}</Notice> : null}
            <View style={{ gap: space.xs }}>
              <Button
                testID="confirm-decline"
                title={pending ? "Registrando…" : "Recusar orçamento"}
                variant="destructive"
                busy={pending}
                onPress={() => {
                  haptic.medium();
                  answer.mutate({ decision: "decline", note });
                }}
              />
              <Button title="Cancelar" variant="plain" disabled={pending} onPress={() => setDeclining(false)} />
            </View>
          </Sheet>
        </>
      ) : null}
    </ScrollView>
  );
}
