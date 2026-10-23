import { useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import Animated, { LayoutAnimationConfig, useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "@/components/symbol";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AttachmentError, uploadIds, uploading, useAttachments, type Attachment as Picked } from "@/components/attachment-field";
import { Button } from "@/components/button";
import { Composer } from "@/components/composer";
import { DictationStatus, MicButton } from "@/components/dictation";
import { ListRow } from "@/components/list-row";
import { Pill } from "@/components/pill";
import { Section } from "@/components/section";
import { SkeletonHeader, useDelayed } from "@/components/skeleton";
import { Card, Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { appendTranscript, useDictation } from "@/lib/dictation";
import { openAttachment } from "@/lib/files";
import { fileSize, when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useKeyboardVisible, useBottomBarSpace } from "@/lib/layout";
import { enterUp } from "@/lib/motion";
import { ticketLook } from "@/lib/status";
import { fonts, rounded, space, usePalette } from "@/lib/theme";

type Detail = Awaited<ReturnType<typeof api.tickets.get>>;
type Entry = Detail["entries"][number];

/** Messages from the same side less than this apart read as one group. */
const GROUP_MS = 15 * 60 * 1000;
const AVATAR = 28;

/** Who sent each entry, which side it sits on and whether it starts a group. */
function thread(entries: Entry[]) {
  // Files carry no "mine" flag: they are mine when my messages have the same author.
  const me = new Set(entries.filter((e) => e.kind === "message" && e.mine).map((e) => e.author));
  return entries.map((entry, i) => {
    const mine = entry.kind === "message" ? entry.mine : me.has(entry.author);
    const prev = entries[i - 1];
    const prevMine = prev ? (prev.kind === "message" ? prev.mine : me.has(prev.author)) : null;
    const first =
      !prev ||
      prevMine !== mine ||
      prev.author !== entry.author ||
      new Date(entry.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_MS;
    return { entry, mine, first };
  });
}

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/** The Anuntech monogram next to the team's messages (one of the three yellow marks). */
function Monogram() {
  const palette = usePalette();
  return (
    <View
      accessible={false}
      style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center" }}
    >
      <Text maxFontSizeMultiplier={1} style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: palette.onBrand }}>
        A
      </Text>
    </View>
  );
}

/** "Fulano · Equipe Anuntech · 20 de out., 21:30" above a group, or "Você · …" on the right. */
function AuthorLine({ entry, mine }: { entry: Entry; mine: boolean }) {
  const palette = usePalette();
  if (mine)
    return (
      <Text variant="caption" tone="muted" style={{ textAlign: "right" }}>
        Você · {when(entry.createdAt)}
      </Text>
    );
  // The team's tag, unless the name already says it.
  const team = entry.staff && !/anuntech/i.test(entry.author) ? " · Equipe Anuntech" : "";
  return (
    <Text variant="caption" tone="muted" style={{ marginLeft: AVATAR + space.sm }}>
      <Text variant="caption" style={{ fontFamily: fonts.semibold, color: palette.foreground }}>
        {entry.author}
      </Text>
      {team} · {when(entry.createdAt)}
    </Text>
  );
}

/** A file in the thread: tapping downloads it and opens the share sheet. */
function Attachment({ entry, mine }: { entry: Extract<Entry, { kind: "file" }>; mine: boolean }) {
  const palette = usePalette();
  const image = !!entry.mime?.startsWith("image/");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Anexo ${entry.name}, ${fileSize(entry.size)}`}
      onPress={() =>
        void openAttachment(entry.href, entry.name).catch(() =>
          Alert.alert("Não foi possível abrir o anexo", "Confira a internet e tente de novo."),
        )
      }
      style={({ pressed }) => ({
        maxWidth: "80%",
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        ...rounded(16),
        backgroundColor: pressed ? palette.fill : mine ? palette.primaryTint : palette.card,
      })}
    >
      <View style={{ width: 32, height: 32, ...rounded(8), backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
        <SymbolView name={image ? "photo" : "doc.fill"} size={16} tintColor={palette.primary} accessible={false} />
      </View>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>
          {entry.name}
        </Text>
        <Text variant="caption" tone="muted">
          {fileSize(entry.size)}
        </Text>
      </View>
      <SymbolView name="arrow.down.circle" size={18} tintColor={palette.primary} accessible={false} />
    </Pressable>
  );
}

/** A label and what it says, as the web's "Detalhes" list. */
function Fact({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <View accessible accessibilityLabel={[label, value, detail].filter(Boolean).join(", ")} style={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="body" selectable>
        {value}
      </Text>
      {detail ? (
        <Text variant="caption" tone="muted" selectable>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** The improvement's estimate (SUP 5.1): the Administrador approves or declines; a Membro reads who does. */
function EstimateCard({ ticketId, estimate }: { ticketId: string; estimate: NonNullable<Detail["estimate"]> }) {
  const queryClient = useQueryClient();
  const decide = useMutation({
    mutationFn: (decision: "approve" | "decline") => api.tickets.decideEstimate({ id: ticketId, decision, minutes: estimate.minutes }),
    onSuccess: async ({ message }) => {
      haptic.success();
      AccessibilityInfo.announceForAccessibility(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
    },
    onError: () => haptic.error(),
  });
  return (
    <Card tone={estimate.status === "proposed" && estimate.canApprove ? "warning" : undefined}>
      <View style={{ gap: 2 }}>
        <Text variant="headline" accessibilityRole="header">
          Estimativa da melhoria
        </Text>
        <Text variant="subhead" tone="muted">
          {estimate.amount} do seu banco de horas.
        </Text>
      </View>
      {estimate.status === "proposed" ? (
        estimate.canApprove ? (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button
              title="Aprovar"
              size="small"
              busy={decide.isPending && decide.variables === "approve"}
              disabled={decide.isPending}
              onPress={() => decide.mutate("approve")}
            />
            <Button
              title="Recusar"
              size="small"
              variant="secondary"
              busy={decide.isPending && decide.variables === "decline"}
              disabled={decide.isPending}
              onPress={() => decide.mutate("decline")}
            />
          </View>
        ) : (
          <Text variant="subhead" tone="muted">
            Um Administrador da sua empresa aprova ou recusa a estimativa.
          </Text>
        )
      ) : (
        <Text variant="subhead" tone="muted">
          {estimate.status === "approved" ? "Aprovada. A equipe pode começar." : "Recusada."}
        </Text>
      )}
      {decide.error ? <Notice kind="error">{errorMessage(decide.error)}</Notice> : null}
    </Card>
  );
}

/** One ticket: what it is about, the conversation and the reply box. */
export default function Ticket() {
  const palette = usePalette();
  const reduceMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // The closed notice sits where the composer would: above the floating tab bar.
  const tabBar = useBottomBarSpace();
  const typing = useKeyboardVisible();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Picked[]>([]);
  const [waitFiles, setWaitFiles] = useState(false);
  const dictation = useDictation((text) => {
    const result = appendTranscript(body, text, 10000);
    setBody(result.value);
    if (result.truncated) return "O texto passou do limite de 10.000 caracteres e foi cortado. Revise antes de enviar.";
  });
  const ticket = useQuery({ queryKey: ["ticket", id], queryFn: () => api.tickets.get({ id }) });
  const loading = useDelayed(ticket.isPending);
  const attach = useAttachments({ value: files, onChange: setFiles, target: { kind: "ticket", companyId: ticket.data?.companyId ?? "" } });
  const ready = uploadIds(files);
  const reply = useMutation({
    mutationFn: () => api.tickets.reply({ id, body: body.trim(), uploadIds: ready }),
    onSuccess: async ({ message }) => {
      setBody("");
      setFiles([]);
      dictation.dismiss();
      haptic.success();
      AccessibilityInfo.announceForAccessibility(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      ]);
      scroll.current?.scrollToEnd({ animated: !reduceMotion });
    },
    onError: () => haptic.error(),
  });
  const t = ticket.data;
  const look = t ? (ticketLook[t.status] ?? ticketLook.open) : null;
  const send = () => {
    // What was said is still on its way: sending now would leave it out.
    if (dictation.phase === "transcribing") return;
    if (dictation.busy) dictation.cancel();
    // A file still on its way would be left behind: the reply waits for it.
    if (uploading(files)) return setWaitFiles(true);
    setWaitFiles(false);
    reply.mutate();
  };
  const marked = t && (t.priority === "high" || t.priority === "critical");
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.lg, gap: space.block }}
        refreshControl={<RefreshControl refreshing={ticket.isRefetching} onRefresh={() => void ticket.refetch()} />}
      >
        {loading && <SkeletonHeader />}
        {ticket.error && <Notice kind="error">{errorMessage(ticket.error)}</Notice>}
        {t && look && (
          <>
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                <Pill label={t.statusLabel} tone={look.tone} icon={look.icon} />
                {marked ? (
                  <Pill
                    label={`Prioridade ${t.priorityLabel}`}
                    tone={t.priority === "critical" ? "danger" : "attention"}
                    icon="exclamationmark.triangle.fill"
                  />
                ) : null}
              </View>
              <Text variant="title" accessibilityRole="header">
                {t.subject}
              </Text>
              <Text variant="subhead" tone="muted">
                {[t.company, t.engagement, t.kindLabel].filter(Boolean).join(" · ")}
              </Text>
              {t.assigneeName ? (
                <View accessible accessibilityLabel={`Com ${t.assigneeName}`} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <View
                    style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text variant="micro" tone="primary" maxFontSizeMultiplier={1}>
                      {initials(t.assigneeName)}
                    </Text>
                  </View>
                  <Text variant="subhead" tone="muted" style={{ flexShrink: 1 }}>
                    Com {t.assigneeName}
                  </Text>
                </View>
              ) : null}
            </View>
            {t.waitingFor ? (
              <Notice kind="warning" title="A equipe precisa de você">
                {t.waitingFor}
              </Notice>
            ) : null}
            {t.estimate ? <EstimateCard ticketId={t.id} estimate={t.estimate} /> : null}
            {t.clock ? (
              <Section header="Prazos" footer={t.clock.label} indent={space.lg}>
                <Fact label="Primeira resposta" value={t.clock.firstResponse} detail={t.clock.firstResponseAt} />
                {t.clock.resolution ? <Fact label="Meta de solução" value={t.clock.resolution} /> : null}
                {t.clock.paused ? <Fact label="Prazo" value={t.clock.paused} /> : null}
                <ListRow title={<Text variant="body" tone="primary">Como contamos o tempo</Text>} onPress={() => router.push("/como-trabalhamos")} />
              </Section>
            ) : null}
            <Section header="Detalhes" indent={space.lg}>
              {t.kindLabel ? <Fact label="Tipo" value={t.kindLabel} detail={t.impactLabel} /> : null}
              {t.engagement ? <Fact label="Produto ou projeto" value={t.engagement} /> : null}
              <Fact label="Aberto por" value={t.author} detail={t.authorEmail} />
              <Fact label="Aberto em" value={when(t.createdAt)} />
              <Fact label="Última atividade" value={when(t.updatedAt)} />
            </Section>
            {/* Only messages that arrive after the screen opens slide in. */}
            <LayoutAnimationConfig skipEntering>
              <View>
                {thread(t.entries).map(({ entry, mine, first }, i) => {
                  const spacing = { marginTop: i === 0 ? 0 : first ? space.lg : space.xs, gap: space.xs };
                  const side = (
                    <View style={{ flexDirection: "row", gap: space.sm, justifyContent: mine ? "flex-end" : "flex-start" }}>
                      {mine ? null : first && entry.staff ? <Monogram /> : <View style={{ width: AVATAR }} />}
                      {entry.kind === "message" ? (
                        <View
                          style={{
                            maxWidth: "80%",
                            ...rounded(20),
                            ...(mine ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }),
                            backgroundColor: mine ? palette.primary : palette.card,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                          }}
                        >
                          <Text selectable tone={mine ? "inverse" : "foreground"}>
                            {entry.body}
                          </Text>
                        </View>
                      ) : (
                        <Attachment entry={entry} mine={mine} />
                      )}
                    </View>
                  );
                  return entry.kind === "message" ? (
                    <Animated.View
                      key={`m-${entry.id}`}
                      entering={enterUp}
                      accessible
                      accessibilityLabel={`${mine ? "Você" : entry.author}, ${when(entry.createdAt)}: ${entry.body}`}
                      style={spacing}
                    >
                      {first ? <AuthorLine entry={entry} mine={mine} /> : null}
                      {side}
                    </Animated.View>
                  ) : (
                    <Animated.View key={`f-${entry.id}`} entering={enterUp} style={spacing}>
                      {first ? <AuthorLine entry={entry} mine={mine} /> : null}
                      {side}
                    </Animated.View>
                  );
                })}
              </View>
            </LayoutAnimationConfig>
          </>
        )}
      </ScrollView>
      {t &&
        (t.canReply ? (
          <Composer
            value={body}
            onChangeText={setBody}
            onSend={send}
            placeholder="Escreva sua resposta"
            sendLabel="Enviar resposta"
            busy={reply.isPending}
            canSend={ready.length > 0}
            leading={
              <Pressable
                testID="attach"
                accessibilityRole="button"
                accessibilityLabel="Anexar"
                accessibilityHint="Câmera, fotos ou arquivo"
                hitSlop={7}
                onPress={attach.choose}
                style={({ pressed }) => ({
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? palette.fill : "transparent",
                })}
              >
                <SymbolView name="paperclip" size={18} weight="medium" tintColor={palette.primary} accessible={false} />
              </Pressable>
            }
            accessory={
              attach.chips || attach.error || waitFiles ? (
                <View style={{ gap: space.sm }}>
                  {attach.chips}
                  {attach.error ? <AttachmentError>{attach.error}</AttachmentError> : null}
                  {waitFiles && uploading(files) ? <AttachmentError>Espere os anexos terminarem de enviar.</AttachmentError> : null}
                </View>
              ) : undefined
            }
            error={reply.error ? errorMessage(reply.error) : null}
            testID="reply"
            sendTestID="send-reply"
            trailing={dictation.available ? <MicButton dictation={dictation} testID="reply-mic" /> : undefined}
            status={<DictationStatus dictation={dictation} />}
          />
        ) : (
          <View style={{ paddingHorizontal: 12, paddingTop: space.sm, paddingBottom: typing ? space.sm : tabBar, gap: space.sm }}>
            <Notice kind="info">Este chamado foi encerrado. Abra um novo chamado para continuar o atendimento.</Notice>
            <Button
              title="Abrir novo chamado"
              variant="secondary"
              size="small"
              icon="square.and.pencil"
              onPress={() => router.push({ pathname: "/chamados/novo", params: { companyId: t.companyId } })}
            />
          </View>
        ))}
    </KeyboardAvoidingView>
  );
}
