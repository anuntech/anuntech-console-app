import { useRef, useState, type ComponentRef } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
import { VersionsSection } from "@/components/versions-section";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { api, errorMessage } from "@/lib/api";
import { civilDate, money, when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { openHelp } from "@/lib/help-link";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { rounded, space, usePalette } from "@/lib/theme";
import { documentLine, preparedLine, rateLine } from "@/lib/quote-document";
import { quoteTone } from "@/lib/tones";

type Detail = Awaited<ReturnType<typeof api.quotes.get>>;
type Decision = "accept" | "decline";

const hours = (min: number, max: number) => (min === max ? `${min} h` : `${min} a ${max} h`);
/** "P1-01": a task's address inside the proposal, as the web and the PDF number it. */
const taskCode = (phase: number, task: number) => `P${phase + 1}-${String(task + 1).padStart(2, "0")}`;

/** One phase of the proposal: its name and hours, what it is for, and its tasks numbered as in the PDF. */
function Phase({ phase, index }: { phase: Detail["phases"][number]; index: number }) {
  const tasks = phase.tasks.length ? `${phase.tasks.length} ${phase.tasks.length === 1 ? "tarefa" : "tarefas"} · ` : "";
  const weeks = phase.weeks ? ` · ${phase.weeks === 1 ? "1 semana" : `${phase.weeks} semanas`}` : "";
  const count = `${tasks}${hours(phase.hoursMin, phase.hoursMax)}${weeks}`;
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
              accessibilityLabel={[taskCode(index, taskIndex), task.title, task.description.trim()].filter(Boolean).join(", ")}
              style={{ flexDirection: "row", gap: space.sm }}
            >
              <Text variant="caption" tone="muted" style={{ width: 48, paddingTop: 1, fontVariant: ["tabular-nums"] }}>
                {taskCode(index, taskIndex)}
              </Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">{task.title}</Text>
                {task.description.trim() ? (
                  <Text variant="subhead" tone="muted" selectable>
                    {task.description.trim()}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <Text variant="caption" tone="muted" style={{ textAlign: "right", fontVariant: ["tabular-nums"] }}>
        Subtotal {phase.name}: <Text variant="caption">{hours(phase.hoursMin, phase.hoursMax)}</Text>
      </Text>
    </View>
  );
}

/** The web's "Resumo por fase": each phase with its tasks and hours, and the total. */
function PhaseSummary({ phases, tasks, hoursMin, hoursMax }: { phases: Detail["phases"]; tasks: number; hoursMin: number; hoursMax: number }) {
  const count = (n: number) => `${n} ${n === 1 ? "tarefa" : "tarefas"}`;
  return (
    <Section header="Resumo por fase" indent={space.lg}>
      {phases.map((phase, index) => (
        <ListRow key={index} title={phase.name} subtitle={count(phase.tasks.length)} value={hours(phase.hoursMin, phase.hoursMax)} />
      ))}
      <ListRow title="Total" titleStyle="semibold" subtitle={count(tasks)} value={hours(hoursMin, hoursMax)} valueTone="foreground" />
    </Section>
  );
}

/** The web's closing box: the estimate, how the price is reached, and the total. */
function TotalBox({ q }: { q: Detail }) {
  const palette = usePalette();
  const rate = rateLine(q.hoursMax, q.hourlyRateCents, q.discountCents);
  return (
    <View
      accessible
      accessibilityLabel={`Total estimado do projeto, ${hours(q.hoursMin, q.hoursMax)}. ${rate}. ${money(q.totalCents)}`}
      style={{ gap: space.md, padding: space.lg, ...rounded(20), backgroundColor: palette.primary }}
    >
      <View style={{ gap: 2 }}>
        <Text variant="micro" tone="inverse" style={{ textTransform: "uppercase", opacity: 0.8 }}>
          Total estimado do projeto
        </Text>
        <Text variant="title" tone="inverse" style={{ fontVariant: ["tabular-nums"] }}>
          {hours(q.hoursMin, q.hoursMax)}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="inverse" style={{ opacity: 0.8, fontVariant: ["tabular-nums"] }}>
          {rate}
        </Text>
        <Text variant="title" tone="inverse" style={{ fontVariant: ["tabular-nums"] }}>
          {money(q.totalCents)}
        </Text>
      </View>
    </View>
  );
}

/** After the client accepts: the web's "Próximos passos", each opening its area. */
const nextSteps = (upfront: boolean) =>
  [
    { title: "Contrato", text: "A Anuntech prepara e envia para assinatura. Você pode pedir alterações em cada cláusula.", href: "/contratos" as const },
    upfront ? { title: "Entrada", text: "A cobrança aparece em Financeiro.", href: "/financeiro" as const } : null,
    { title: "Acessos", text: "A equipe pede o que precisa por chamado.", href: "/chamados" as const },
    {
      title: "Início",
      text: `A reunião de início é marcada depois ${upfront ? "dos três passos" : "do contrato assinado e dos acessos"}. O andamento fica em Projetos.`,
      href: "/projetos" as const,
    },
  ].filter((step) => step !== null);

/** A step's number in a violet circle, as the web's list. */
function StepNumber({ n }: { n: number }) {
  const palette = usePalette();
  return (
    <View
      accessible={false}
      style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}
    >
      <Text variant="micro" tone="primary">
        {n}
      </Text>
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
  const palette = usePalette();
  const tasks = q ? q.phases.reduce((sum, phase) => sum + phase.tasks.length, 0) : 0;
  const signer = me.data ? me.data.name.trim() || me.data.email : "";
  const staff = !!me.data?.staff;
  const pending = answer.isPending;
  const failed = answer.error ? answer.variables?.decision : null;

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
        <View style={{ flex: 1, gap: 2 }}>
          {q.validityLabel ? (
            <Text variant="micro" tone="warning">
              {q.validityLabel}
            </Text>
          ) : null}
          <Text variant="subhead">Aguardando a sua resposta. Leia a proposta e responda abaixo.</Text>
        </View>
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
            {documentLine(q.companyDocument) ? (
              <Text variant="caption" tone="muted" selectable>
                {documentLine(q.companyDocument)}
              </Text>
            ) : null}
          </View>
          <View accessible accessibilityLabel={`Total, ${money(q.totalCents)}`} style={{ gap: 2 }}>
            <Text variant="caption" tone="muted">
              Total
            </Text>
            <Text variant="display">{money(q.totalCents)}</Text>
          </View>
          {status}
          <Section
            indent={space.lg}
            footer={
              // The web's line under the figures, when a discount was negotiated.
              q.discountCents > 0
                ? `Valor das horas ${money(q.subtotalCents)}, com desconto negociado de ${money(q.discountCents)} (${q.discountShare}).`
                : undefined
            }
          >
            {q.hoursMax > 0 ? <ListRow title="Esforço estimado" value={hours(q.hoursMin, q.hoursMax)} /> : null}
            {q.hourlyRateCents > 0 ? <ListRow title="Taxa/hora" value={`${money(q.hourlyRateCents)}/h`} /> : null}
            {q.phases.length ? (
              <ListRow
                title={q.phases.length === 1 ? "Fase" : "Fases"}
                value={`${q.phases.length} · ${tasks} ${tasks === 1 ? "tarefa" : "tarefas"}`}
              />
            ) : null}
            {/* As the web's document: both lines, even with no entry (0%) or all of it up front. */}
            <ListRow title={`Entrada (${q.upfrontPercent}%)`} value={money(q.upfrontCents)} />
            <ListRow title={`Saldo (${100 - q.upfrontPercent}%)`} value={money(q.balanceCents)} />
            {q.validUntil ? (
              <ListRow
                title="Válido até"
                value={
                  q.expired
                    ? `${civilDate(q.validUntil)} · Expirado`
                    : q.validityLabel
                      ? `${civilDate(q.validUntil)} · ${q.validityLabel}`
                      : civilDate(q.validUntil)
                }
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
          {q.stack.length ? (
            <Section header="Tecnologias">
              <View
                accessible
                accessibilityLabel={`Tecnologias: ${q.stack.join(", ")}`}
                style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, padding: space.lg }}
              >
                {q.stack.map((item) => (
                  <View key={item} style={{ paddingHorizontal: 10, paddingVertical: 4, ...rounded(8), backgroundColor: palette.secondary }}>
                    <Text variant="caption">{item}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}
          {q.phases.length ? <PhaseSummary phases={q.phases} tasks={tasks} hoursMin={q.hoursMin} hoursMax={q.hoursMax} /> : null}
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
          <TotalBox q={q} />
          <Text variant="caption" tone="muted" style={{ marginTop: -space.sm }}>
            {preparedLine(q.sentAt ?? q.updatedAt, q.validUntil)}
          </Text>
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
                  <Button
                    title="Como funciona o aceite"
                    variant="plain"
                    size="small"
                    icon="questionmark.circle"
                    disabled={pending}
                    onPress={() => openHelp("responder-um-orcamento")}
                  />
                </Card>
              ) : null}
            </View>
          ) : null}
          {!staff && q.status === "accepted" ? (
            <Section header="Próximos passos" indent={52}>
              {nextSteps(q.upfrontCents > 0).map((step, index) => (
                <ListRow
                  key={step.title}
                  leading={<StepNumber n={index + 1} />}
                  title={step.title}
                  subtitle={step.text}
                  onPress={() => router.push(step.href)}
                />
              ))}
            </Section>
          ) : null}
          {q.documentHash ? (
            <DocumentFacts
              hash={q.documentHash}
              version={q.version}
              sent={q.sentAt ? when(q.sentAt) : null}
              facts={[
                ...(q.decision?.email ? [{ title: "E-mail de quem respondeu", value: q.decision.email }] : []),
                ...(q.decision?.ip ? [{ title: "IP", value: q.decision.ip }] : []),
              ]}
            />
          ) : null}
          <Section>
            <PdfRow path={q.pdfPath} name={`Orçamento ${q.number}.pdf`} title="Ver proposta em PDF" icon="doc.richtext.fill" />
          </Section>
          <VersionsSection
            versions={q.versions}
            name={`Orçamento ${q.number}`}
            footer="Cada envio congela uma proposta. As anteriores ficam para consulta, sem efeito."
          />
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
