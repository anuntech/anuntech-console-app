import { useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import Animated, { LayoutAnimationConfig, useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Composer } from "@/components/composer";
import { Pill } from "@/components/pill";
import { SkeletonHeader, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
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
  const ticket = useQuery({ queryKey: ["ticket", id], queryFn: () => api.tickets.get({ id }) });
  const loading = useDelayed(ticket.isPending);
  const reply = useMutation({
    mutationFn: () => api.tickets.reply({ id, body: body.trim() }),
    onSuccess: async () => {
      setBody("");
      haptic.success();
      AccessibilityInfo.announceForAccessibility("Resposta enviada");
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
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.lg, gap: space.block }}
      >
        {loading && <SkeletonHeader />}
        {ticket.error && <Notice kind="error">{errorMessage(ticket.error)}</Notice>}
        {t && look && (
          <>
            <View style={{ gap: space.sm }}>
              <Pill label={t.statusLabel} tone={look.tone} icon={look.icon} />
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
            onSend={() => reply.mutate()}
            placeholder="Escreva sua resposta"
            sendLabel="Enviar resposta"
            busy={reply.isPending}
            error={reply.error ? errorMessage(reply.error) : null}
            testID="reply"
            sendTestID="send-reply"
          />
        ) : (
          <View style={{ paddingHorizontal: 12, paddingTop: space.sm, paddingBottom: typing ? space.sm : tabBar, gap: space.sm }}>
            <Notice kind="info">O chamado está encerrado. Abra um novo chamado para continuar o atendimento.</Notice>
            <Button title="Abrir chamado" variant="secondary" size="small" icon="square.and.pencil" onPress={() => router.push("/chamados/novo")} />
          </View>
        ))}
    </KeyboardAvoidingView>
  );
}
