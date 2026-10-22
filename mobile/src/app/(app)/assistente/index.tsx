import { useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Card, Notice } from "@/components/surface";
import { Markdown } from "@/components/markdown";
import { ProposalCardView } from "@/components/proposal-card";
import { Text } from "@/components/text";
import { loadConversation, sendTurn, type Card as ProposalCard, type PageAction } from "@/lib/assistant";
import { CONSOLE_URL } from "@/lib/config";
import { useKeyboardVisible, useTabBarSpace } from "@/lib/layout";
import { fonts, radius, space, usePalette } from "@/lib/theme";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  cards?: ProposalCard[];
  links?: { label: string; href: string }[];
  failed?: boolean;
};

const suggestions = [
  "O que está aguardando minha resposta?",
  "Tenho faturas em aberto?",
  "Como está o andamento dos projetos?",
];

const phaseLabels: Record<string, string> = {
  tools: "Consultando o Console…",
  reading: "Lendo o que encontrou…",
  answer: "Escrevendo a resposta…",
};

/** The screens of the app a Console path opens; other paths open in the browser. */
function appRoute(href: string): string | null {
  const path = href.split("?")[0];
  if (/^\/(chamados|financeiro|projetos|contratos|orcamentos)(\/[\w-]+)?$/.test(path) || path === "/bookmarks") return path;
  if (path === "/chamados/novo") return path;
  if (path === "/painel" || path === "/") return "/";
  return null;
}

/** Links the answer offers: the screens it points at, or a new ticket. */
function linksFrom(actions: PageAction[]) {
  const links: { label: string; href: string }[] = [];
  for (const action of actions) {
    if (action.type === "open_support") links.push({ label: "Abrir chamado", href: "/chamados/novo" });
    else if (action.type === "navigate" && "href" in action) links.push({ label: "Abrir", href: action.href });
  }
  return links;
}

/**
 * The assistant: the same one as the Console's panel, with the person's own
 * access. Changes come as cards that run only when the person confirms. A
 * conversation picked in Conversas opens here with its messages.
 */
export default function Assistant() {
  const { conversa } = useLocalSearchParams<{ conversa?: string }>();
  const stored = useQuery({
    queryKey: ["assistant-conversation", conversa],
    queryFn: () => loadConversation(conversa!),
    enabled: !!conversa,
    staleTime: Infinity,
  });
  if (conversa && stored.isPending) return <ActivityIndicator accessibilityLabel="Carregando" style={{ marginTop: space.block }} />;
  const initial = stored.data?.messages.map((m) => ({ id: m.id, role: m.role, text: m.content, steps: m.steps })) ?? [];
  return (
    <Chat
      key={conversa ?? "nova"}
      initialId={stored.data?.id}
      initialMessages={conversa ? initial : []}
      loadError={conversa && stored.error ? stored.error.message : null}
    />
  );
}

function Chat({ initialId, initialMessages, loadError }: { initialId?: string; initialMessages: Message[]; loadError: string | null }) {
  const palette = usePalette();
  const tabBar = useTabBarSpace();
  const typing = useKeyboardVisible();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | undefined>(initialId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(loadError);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);

  const update = (id: string, change: (m: Message) => Message) =>
    setMessages((list) => list.map((m) => (m.id === id ? change(m) : m)));

  const start = () => {
    abort.current?.abort();
    if (initialId) router.setParams({ conversa: undefined });
    else {
      setMessages([]);
      setConversationId(undefined);
      setError(null);
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    seq.current += 1;
    const answerId = `a-${seq.current}`;
    setDraft("");
    setError(null);
    setBusy(true);
    setPhase("tools");
    setMessages((list) => [...list, { id: `u-${seq.current}`, role: "user", text: message }, { id: answerId, role: "assistant", text: "" }]);
    const controller = new AbortController();
    abort.current = controller;
    try {
      await sendTurn(
        { message, conversationId },
        {
          text: (delta) => update(answerId, (m) => ({ ...m, text: m.text + delta })),
          steps: (steps) => update(answerId, (m) => ({ ...m, steps })),
          phase: setPhase,
          card: (card) => update(answerId, (m) => ({ ...m, cards: [...(m.cards ?? []), card] })),
          actions: (actions) => update(answerId, (m) => ({ ...m, links: linksFrom(actions) })),
          finish: (meta) => {
            if (meta.conversationId) setConversationId(meta.conversationId);
          },
        },
        controller.signal,
      );
      void queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
    } catch (e) {
      if (!controller.signal.aborted) {
        update(answerId, (m) => ({ ...m, failed: true }));
        setError(e instanceof Error ? e.message : "O assistente não respondeu. Tente de novo.");
      }
    } finally {
      setBusy(false);
      setPhase("");
    }
  };

  const open = (href: string) => {
    const route = appRoute(href);
    if (route) router.push(route as never);
    else void WebBrowser.openBrowserAsync(`${CONSOLE_URL}${href}`);
  };

  // A confirmed change may have touched what other screens show.
  const changed = (actions: PageAction[]) => {
    void queryClient.invalidateQueries();
    const links = linksFrom(actions);
    if (links[0]) open(links[0].href);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.push("/assistente/conversas" as never)}>
              <Text variant="label" tone="primary" style={{ fontSize: 16 }}>
                Conversas
              </Text>
            </Pressable>
          ),
          headerRight: () =>
            messages.length ? (
              <Pressable accessibilityRole="button" hitSlop={12} onPress={start}>
                <Text variant="label" tone="primary" style={{ fontSize: 16 }}>
                  Nova
                </Text>
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {!messages.length ? (
          <View style={{ gap: space.md, marginTop: space.lg }}>
            <Text variant="heading">Como posso ajudar?</Text>
            <Text tone="muted">
              Pergunte sobre seus chamados, faturas, projetos e contratos. Quando for preciso mudar algo, eu preparo e você
              confirma.
            </Text>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                onPress={() => void send(s)}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.card,
                  borderRadius: radius.lg,
                  padding: space.md,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {messages.map((m) =>
          m.role === "user" ? (
            <View
              key={m.id}
              style={{
                alignSelf: "flex-end",
                maxWidth: "85%",
                backgroundColor: palette.primary,
                borderRadius: radius.xl,
                paddingHorizontal: space.md,
                paddingVertical: space.sm + 2,
              }}
            >
              <Text selectable style={{ color: palette.primaryForeground }}>
                {m.text}
              </Text>
            </View>
          ) : (
            <View key={m.id} style={{ gap: space.sm, maxWidth: "100%" }}>
              {m.steps?.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                  {m.steps.map((step, i) => (
                    <View key={`${step}-${i}`} style={{ backgroundColor: palette.secondary, borderRadius: radius.xl, paddingHorizontal: space.sm, paddingVertical: 2 }}>
                      <Text variant="caption" tone="muted">
                        {step}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {m.text ? (
                <Card>
                  <Markdown text={m.text} onLink={open} />
                </Card>
              ) : busy && m.id === messages[messages.length - 1]?.id ? (
                <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
                  <ActivityIndicator />
                  <Text variant="caption" tone="muted">
                    {phaseLabels[phase] ?? "Pensando…"}
                  </Text>
                </View>
              ) : m.failed ? (
                <Text variant="caption" tone="muted">
                  Sem resposta.
                </Text>
              ) : null}
              {m.cards?.map((card) => <ProposalCardView key={card.id} card={card} onDone={changed} />)}
              {m.links?.map((link) => (
                <Button key={link.href} title={link.label} variant="outline" onPress={() => open(link.href)} />
              ))}
            </View>
          ),
        )}
        {error ? <Notice kind="error">{error}</Notice> : null}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: space.sm,
          borderTopWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.card,
          padding: space.md,
          paddingBottom: typing ? space.md : tabBar,
        }}
      >
        <TextInput
          testID="assistant-message"
          accessibilityLabel="Mensagem para o assistente"
          placeholder="Pergunte ao assistente"
          placeholderTextColor={palette.muted}
          multiline
          value={draft}
          onChangeText={setDraft}
          maxLength={4000}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 140,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: palette.fieldBorder,
            backgroundColor: palette.field,
            paddingHorizontal: space.md,
            paddingTop: space.sm + 2,
            paddingBottom: space.sm + 2,
            fontFamily: fonts.regular,
            fontSize: 16,
            letterSpacing: 0,
            textAlign: "left",
            color: palette.foreground,
          }}
        />
        <View style={{ width: 92 }}>
          <Button title="Enviar" testID="assistant-send" busy={busy} disabled={!draft.trim() || busy} onPress={() => void send(draft)} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
