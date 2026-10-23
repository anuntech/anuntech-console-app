import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Composer } from "@/components/composer";
import { DictationStatus, MicButton } from "@/components/dictation";
import { ListRow } from "@/components/list-row";
import { Markdown } from "@/components/markdown";
import { ProposalCardView } from "@/components/proposal-card";
import { Section } from "@/components/section";
import { Bar, useDelayed } from "@/components/skeleton";
import { Text } from "@/components/text";
import { loadConversation, sendTurn, type Card as ProposalCard, type PageAction } from "@/lib/assistant";
import { CONSOLE_URL, SUPPORT_WHATSAPP_URL } from "@/lib/config";
import { appendTranscript, useDictation } from "@/lib/dictation";
import { useMe } from "@/lib/me";
import { askAssistantConsent } from "@/lib/consent";
import { enterUp } from "@/lib/motion";
import { HeaderIconButton } from "@/lib/stack";
import { rounded, space, usePalette } from "@/lib/theme";

/** `external`: opens another app (WhatsApp); otherwise a screen of the app or the Console in the browser. */
type Link = { label: string; href: string; inApp: boolean; external?: boolean };

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  cards?: ProposalCard[];
  links?: Link[];
  failed?: boolean;
  /** Stopped with "Parar resposta" before it finished. */
  stopped?: boolean;
  /** Arrived in this session (enters with motion); stored ones just appear. */
  fresh?: boolean;
};

type Suggestion = { icon: SFSymbol; text: string };

/**
 * The first questions, as the web's panel offers them (assistant-panel.tsx,
 * suggestionsFor): money only for whoever sees finance, tickets only for
 * whoever reaches support, and the team's own list for the team.
 */
function suggestionsFor(staff: boolean, finance: boolean, support: boolean): Suggestion[] {
  if (staff)
    return [
      { icon: "exclamationmark.triangle", text: "Quais faturas estão vencidas?" },
      { icon: "bubble.left.and.bubble.right", text: "Quais chamados estão abertos?" },
      { icon: "square.grid.2x2", text: "Monte um projeto com tarefas para um site institucional" },
      { icon: "building.2", text: "Me dê um resumo de uma empresa" },
    ];
  return [
    finance
      ? { icon: "barcode", text: "Qual é o meu último boleto?" }
      : { icon: "chart.bar.xaxis", text: "Como estão meus projetos?" },
    support
      ? { icon: "exclamationmark.bubble", text: "Tem chamado esperando minha resposta?" }
      : { icon: "shippingbox", text: "Quais produtos eu tenho?" },
    finance
      ? { icon: "list.bullet.rectangle.portrait", text: "Tenho algum orçamento aguardando resposta?" }
      : { icon: "info.circle", text: "O que a Anuntech faz?" },
    { icon: "person.wave.2", text: "Quero falar com alguém da Anuntech" },
  ];
}

/** The routes of the shortcuts under the box; Ajuda is a screen of its own (frente 7). */
const NEW_TICKET = "/chamados/novo";
const HELP = "/ajuda";

const phaseLabels: Record<string, string> = {
  tools: "Consultando o Console…",
  reading: "Lendo o que encontrou…",
  answer: "Escrevendo a resposta…",
};

/** The longest message the box takes (the server takes up to 20,000, assistant-http.ts). */
const MAX_MESSAGE = 4000;

/** Distance from the bottom (pt) within which the conversation follows a new answer. */
const FOLLOW = 80;

/** The screens of the app a Console path opens; other paths open in the browser. */
function appRoute(href: string): string | null {
  const path = href.split("?")[0];
  if (/^\/(chamados|financeiro|projetos|contratos|orcamentos)(\/[\w-]+)?$/.test(path) || path === "/bookmarks") return path;
  if (path === "/chamados/novo") return path;
  if (path === "/painel" || path === "/") return "/";
  return null;
}

/** What a link button says, from where it goes. */
function linkLabel(href: string): string {
  const path = href.split("?")[0];
  if (path === "/chamados/novo") return "Abrir chamado";
  const named: [RegExp, string][] = [
    [/^\/chamados\/[\w-]+$/, "Ver chamado"],
    [/^\/chamados$/, "Ver chamados"],
    [/^\/financeiro\/[\w-]+$/, "Ver fatura"],
    [/^\/financeiro$/, "Ver faturas"],
    [/^\/projetos\/[\w-]+$/, "Ver projeto"],
    [/^\/projetos$/, "Ver projetos"],
    [/^\/contratos\/[\w-]+$/, "Ver contrato"],
    [/^\/contratos$/, "Ver contratos"],
    [/^\/orcamentos\/[\w-]+$/, "Ver orçamento"],
    [/^\/orcamentos$/, "Ver orçamentos"],
    [/^\/bookmarks$/, "Ver bookmarks"],
    [/^\/(painel)?$/, "Ver início"],
  ];
  return named.find(([pattern]) => pattern.test(path))?.[1] ?? "Abrir no navegador";
}

/**
 * Links the answer offers: the screens it points at or, when the person
 * asked for someone of the Anuntech (the web's support chat), the team's
 * WhatsApp and a new ticket.
 */
function linksFrom(actions: PageAction[]) {
  const links: Link[] = [];
  const add = (href: string, label = linkLabel(href)) => {
    if (!links.some((l) => l.href === href)) links.push({ label, href, inApp: !!appRoute(href) });
  };
  for (const action of actions) {
    if (action.type === "open_support") {
      if (!links.some((l) => l.href === SUPPORT_WHATSAPP_URL))
        links.push({ label: "Falar no WhatsApp", href: SUPPORT_WHATSAPP_URL, inApp: false, external: true });
      add(NEW_TICKET, "Abrir chamado");
    } else if (action.type === "navigate" && "href" in action) add(action.href);
  }
  return links;
}

/** The answer as VoiceOver should read it: no Markdown marks. */
function plain(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/[*`#]/g, "")
    .trim();
}

function announce(text: string) {
  if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  else AccessibilityInfo.announceForAccessibility(text);
}

function ConversationsButton() {
  return (
    <HeaderIconButton
      symbol="clock.arrow.circlepath"
      label="Conversas"
      onPress={() => router.push("/assistente/conversas" as never)}
    />
  );
}

/**
 * The assistant: the same one as the Console's panel, with the person's own
 * access. Changes come as cards that run only when the person confirms. A
 * conversation picked in Conversas opens here with its messages.
 */
export default function Assistant() {
  // `q` fills the box (Ajuda's "Perguntar ao assistente"); the person still sends it.
  const { conversa, q } = useLocalSearchParams<{ conversa?: string; q?: string }>();
  const stored = useQuery({
    queryKey: ["assistant-conversation", conversa],
    queryFn: () => loadConversation(conversa!),
    enabled: !!conversa,
    staleTime: Infinity,
  });
  if (conversa && stored.isPending) return <Loading />;
  const initial: Message[] =
    stored.data?.messages.map((m) => ({ id: m.id, role: m.role, text: m.content, steps: m.steps })) ?? [];
  return (
    <Chat
      key={conversa ?? "nova"}
      initialId={stored.data?.id}
      initialMessages={conversa ? initial : []}
      loadError={conversa && stored.error ? stored.error.message : null}
      prefill={typeof q === "string" ? q : undefined}
    />
  );
}

/** A stored conversation on its way: a bubble and a few lines, after a short delay. */
function Loading() {
  const shown = useDelayed(true, 150);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space.lg }}>
      <Stack.Screen options={{ headerLeft: () => <ConversationsButton />, headerRight: undefined }} />
      {shown ? (
        <View accessible accessibilityLabel="Carregando" style={{ gap: space.lg }}>
          <View style={{ alignSelf: "flex-end" }}>
            <Bar width={180} height={44} radius={20} />
          </View>
          <View style={{ gap: space.sm, paddingLeft: 36 }}>
            <Bar width="90%" height={16} />
            <Bar width="80%" height={16} />
            <Bar width="55%" height={16} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Chat({
  initialId,
  initialMessages,
  loadError,
  prefill,
}: {
  initialId?: string;
  initialMessages: Message[];
  loadError: string | null;
  prefill?: string;
}) {
  const palette = usePalette();
  const me = useMe();
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | undefined>(initialId);
  const [draft, setDraft] = useState(() => (prefill ?? "").slice(0, MAX_MESSAGE));
  // A question that arrives while the screen is open replaces what was in the box.
  const [filled, setFilled] = useState(prefill);
  if (prefill !== filled) {
    setFilled(prefill);
    if (prefill) setDraft(prefill.slice(0, MAX_MESSAGE));
  }
  useEffect(() => {
    // Read once: coming back to the tab must not fill the box again.
    if (prefill) router.setParams({ q: undefined });
  }, [prefill]);
  const staff = !!me.data?.staff;
  const finance = staff || !!me.data?.companies.some((c) => c.role === "manager");
  // Every role of a company reaches support (lib/access/permissions.ts): anyone with a company, or the team.
  const support = staff || !!me.data?.companies.length;
  const dictation = useDictation((text) => {
    const result = appendTranscript(draft, text, MAX_MESSAGE);
    setDraft(result.value);
    if (result.truncated)
      return `O texto passou do limite de ${MAX_MESSAGE.toLocaleString("pt-BR")} caracteres e foi cortado. Revise antes de enviar.`;
  });
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(loadError);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);
  // Follow new text only while the person is at (or near) the bottom.
  const near = useRef(true);
  const streaming = useRef(false);
  const settled = useRef(false);
  const pendingScroll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (id: string, change: (m: Message) => Message) =>
    setMessages((list) => list.map((m) => (m.id === id ? change(m) : m)));

  const onScroll = ({ nativeEvent: e }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const end = e.contentSize.height + (e.contentInset?.bottom ?? 0) - e.layoutMeasurement.height;
    near.current = end - e.contentOffset.y <= FOLLOW;
  };

  // At most once every 100 ms; instant while the answer streams in.
  const follow = () => {
    if (!near.current || pendingScroll.current) return;
    pendingScroll.current = setTimeout(() => {
      pendingScroll.current = null;
      const animated = settled.current && !streaming.current && !reduce;
      settled.current = true;
      scroll.current?.scrollToEnd({ animated });
    }, 100);
  };

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
    // What was said is still on its way: sending now would leave it out.
    if (dictation.phase === "transcribing") return;
    if (dictation.phase === "recording" || dictation.phase === "starting") dictation.cancel();
    // The first message waits for the person's consent; "Agora não" keeps it unsent.
    if (!(await askAssistantConsent(() => router.push("/assistente/consentimento" as never)))) return;
    seq.current += 1;
    const answerId = `a-${seq.current}`;
    setDraft("");
    dictation.dismiss();
    setError(null);
    setBusy(true);
    setPhase("tools");
    near.current = true;
    streaming.current = true;
    setMessages((list) => [
      ...list,
      { id: `u-${seq.current}`, role: "user", text: message, fresh: true },
      { id: answerId, role: "assistant", text: "", fresh: true },
    ]);
    const controller = new AbortController();
    abort.current = controller;
    const spoken = new Set<string>();
    let answer = "";
    try {
      await sendTurn(
        { message, conversationId },
        {
          text: (delta) => {
            answer += delta;
            update(answerId, (m) => ({ ...m, text: m.text + delta }));
          },
          steps: (steps) => update(answerId, (m) => ({ ...m, steps })),
          phase: (next) => {
            setPhase(next);
            const label = phaseLabels[next];
            if (label && !spoken.has(next)) {
              spoken.add(next);
              announce(label);
            }
          },
          card: (card) => update(answerId, (m) => ({ ...m, cards: [...(m.cards ?? []), card] })),
          actions: (actions) => update(answerId, (m) => ({ ...m, links: linksFrom(actions) })),
          finish: (meta) => {
            if (meta.conversationId) setConversationId(meta.conversationId);
          },
        },
        controller.signal,
      );
      if (answer.trim()) announce(plain(answer));
      void queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
    } catch (e) {
      if (controller.signal.aborted) update(answerId, (m) => ({ ...m, stopped: true }));
      else {
        update(answerId, (m) => ({ ...m, failed: true }));
        setError(e instanceof Error ? e.message : "O assistente não respondeu. Tente de novo.");
      }
    } finally {
      streaming.current = false;
      setBusy(false);
      setPhase("");
      requestAnimationFrame(() => {
        if (near.current) scroll.current?.scrollToEnd({ animated: !reduce });
      });
    }
  };

  const open = (href: string) => {
    if (href === SUPPORT_WHATSAPP_URL) {
      void Linking.openURL(href).catch(() => WebBrowser.openBrowserAsync(href));
      return;
    }
    const route = appRoute(href);
    if (route) router.push(route as never);
    else void WebBrowser.openBrowserAsync(`${CONSOLE_URL}${href}`);
  };

  // A confirmed change may have touched what other screens show.
  const changed = (actions: PageAction[]) => {
    void queryClient.invalidateQueries();
    const next = linksFrom(actions).find((link) => !link.external);
    if (next) open(next.href);
  };

  const last = messages[messages.length - 1]?.id;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen
        options={{
          headerLeft: () => <ConversationsButton />,
          headerRight: messages.length
            ? () => <HeaderIconButton symbol="square.and.pencil" label="Nova conversa" onPress={start} />
            : undefined,
        }}
      />
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.lg, gap: space.lg, flexGrow: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onContentSizeChange={follow}
      >
        {!messages.length ? (
          <View style={{ alignItems: "center", marginTop: 40, gap: space.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: palette.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SymbolView name="sparkles" size={30} tintColor={palette.primaryForeground} accessible={false} />
            </View>
            <Text variant="title" accessibilityRole="header" style={{ textAlign: "center" }}>
              Como posso ajudar?
            </Text>
            <Text variant="subhead" tone="muted" style={{ textAlign: "center", maxWidth: 300 }}>
              Pergunte sobre seus chamados, faturas, projetos e contratos. Quando for preciso mudar algo, eu preparo e você
              confirma.
            </Text>
            <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
              Respostas geradas por IA podem conter erros.
            </Text>
            {me.data ? (
              <Section indent={52} style={{ marginTop: space.md, alignSelf: "stretch" }}>
                {suggestionsFor(staff, finance, support).map((s) => (
                  <ListRow
                    key={s.text}
                    title={s.text}
                    leading={
                      <View style={{ width: 24, alignItems: "center" }}>
                        <SymbolView name={s.icon} size={18} tintColor={palette.primary} accessible={false} />
                      </View>
                    }
                    trailing={<SymbolView name="arrow.up.right" size={13} weight="semibold" tintColor={palette.tertiary} accessible={false} />}
                    accessibilityHint="Envia a pergunta ao assistente"
                    onPress={() => void send(s.text)}
                  />
                ))}
              </Section>
            ) : null}
          </View>
        ) : null}
        {messages.map((m) =>
          m.role === "user" ? (
            <Animated.View
              key={m.id}
              entering={m.fresh ? enterUp : undefined}
              accessible
              accessibilityLabel={`Você: ${m.text}`}
              style={{
                alignSelf: "flex-end",
                maxWidth: "80%",
                backgroundColor: palette.primary,
                ...rounded(20),
                borderBottomRightRadius: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text selectable style={{ color: palette.primaryForeground }}>
                {m.text}
              </Text>
            </Animated.View>
          ) : (
            <Turn
              key={m.id}
              message={m}
              thinking={busy && m.id === last}
              phase={phaseLabels[phase] ?? "Pensando…"}
              onLink={open}
              onDone={changed}
            />
          ),
        )}
      </ScrollView>
      <Composer
        value={draft}
        onChangeText={setDraft}
        onSend={() => void send(draft)}
        placeholder="Pergunte ao assistente"
        sendLabel="Enviar"
        busy={busy}
        onStop={() => abort.current?.abort()}
        error={error}
        testID="assistant-message"
        sendTestID="assistant-send"
        maxLength={MAX_MESSAGE}
        trailing={support && dictation.available ? <MicButton dictation={dictation} testID="assistant-mic" /> : undefined}
        status={<DictationStatus dictation={dictation} />}
        footer={
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingHorizontal: space.xs }}>
            {support ? (
              <Button
                title="Abrir chamado"
                variant="secondary"
                size="small"
                icon="square.and.pencil"
                testID="assistant-shortcut-ticket"
                onPress={() => router.push(NEW_TICKET)}
              />
            ) : null}
            <Button
              title="Ajuda"
              variant="secondary"
              size="small"
              icon="questionmark.circle"
              testID="assistant-shortcut-help"
              onPress={() => router.push(HELP as never)}
            />
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

/** One answer, unboxed: the sparkles mark, what it looked at, the text, cards and links. */
function Turn({
  message: m,
  thinking,
  phase,
  onLink,
  onDone,
}: {
  message: Message;
  thinking: boolean;
  phase: string;
  onLink: (href: string) => void;
  onDone: (actions: PageAction[]) => void;
}) {
  const palette = usePalette();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  // The card already says what waits for confirmation.
  const steps = (m.steps ?? []).filter((step) => !(m.cards?.length && step.startsWith("Para você confirmar")));
  return (
    <Animated.View entering={m.fresh ? enterUp : undefined} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          marginTop: 1,
          backgroundColor: palette.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolView
          name="sparkles"
          size={13}
          tintColor={palette.primary}
          accessible={false}
          animationSpec={thinking && !reduce ? { effect: { type: "pulse" }, repeating: true } : undefined}
        />
      </View>
      <View style={{ flex: 1, gap: space.md }}>
        {steps.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`Consultas: ${steps.join(", ")}`}
            onPress={() => setOpen((v) => !v)}
            hitSlop={8}
            style={{ flexDirection: "row", gap: 6, alignItems: open ? "flex-start" : "center" }}
          >
            <SymbolView name="checkmark.circle" size={12} tintColor={palette.muted} accessible={false} style={{ marginTop: open ? 3 : 0 }} />
            <Text variant="caption" tone="muted" numberOfLines={open ? undefined : 1} style={{ flex: 1 }}>
              {open ? steps.join("\n") : steps.join(" · ")}
            </Text>
          </Pressable>
        ) : null}
        {m.text ? (
          <Markdown text={m.text} onLink={onLink} />
        ) : thinking ? (
          <Text variant="subhead" tone="muted" style={{ marginTop: 1 }}>
            {phase}
          </Text>
        ) : m.failed ? (
          <Text variant="caption" tone="muted">
            Sem resposta.
          </Text>
        ) : m.stopped ? (
          <Text variant="caption" tone="muted">
            Resposta interrompida.
          </Text>
        ) : null}
        {m.cards?.map((card) => <ProposalCardView key={card.id} card={card} onDone={onDone} />)}
        {m.links?.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {m.links.map((link) => (
              <Button
                key={link.href}
                title={link.label}
                variant="secondary"
                size="small"
                icon={link.external ? "message.fill" : undefined}
                trailingIcon={link.inApp ? "chevron.right" : "arrow.up.right"}
                accessibilityHint={
                  link.external ? "Abre o WhatsApp da equipe, (11) 5107-3435" : link.inApp ? undefined : "Abre no navegador"
                }
                onPress={() => onLink(link.href)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}
