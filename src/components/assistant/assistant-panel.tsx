"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useChat } from "@ai-sdk/react";
import { AISDKError, APICallError, DefaultChatTransport } from "ai";
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleSlashIcon,
  HistoryIcon,
  Maximize2Icon,
  PanelRightIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { MetalPromptBar } from "@/components/ui/metal-prompt-bar";
import { AiOrb } from "@/components/ui/ai-orb";
import { openSupportWidget } from "@/components/shell/support-trigger";
import { toast } from "@/components/shell/notifications";
import { relativeLabel } from "@/lib/format";
import { PROPOSAL_TTL_MS } from "@/lib/assistant/proposal-ttl";
import { assistantActivity, type AssistantActivity, type DictationActivity, type TurnPhase } from "@/lib/assistant/activity";
import {
  assistantMetadataSchema,
  messageText,
  readActions,
  readCard,
  readPhase,
  refusalText,
  type AssistantMessage,
  type PageAction,
  type ProposalCard as Proposal,
} from "@/lib/assistant/assistant-stream";
import { MessageMarkdown } from "./message-markdown";
import { clickPage, fillPage, snapshotPage } from "./page-bridge";

export type AssistantShortcut = { href: string; label: string };
/** Where a card the assistant prepared stands in this tab; it runs only when the person confirms it here. */
type CardState = {
  status: "pending" | "busy" | "done" | "failed" | "dismissed";
  message?: string;
  /**
   * When the panel stops waiting on it: the server's TTL counted from when
   * the message was sent, which is before the server made the card, so it is
   * never later than the server's own deadline. Only elapsed time on this
   * tab's clock matters, never the hour it shows.
   */
  deadline: number;
};
type ProposalState = Proposal & CardState;
type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: string[];
  failed?: boolean;
  /** How long it took and what it spent; only for answers given in this session. */
  spent?: { ms: number; tokens: number };
  /** Confirmation cards; they live in this tab only (a reload drops them and they expire). */
  proposals?: ProposalState[];
};
type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: number;
};
type SavedMessage = { id: string; role: "user" | "assistant"; content: string; steps?: string[] };
const STORAGE_KEY = "assistant:conversation";

const fallbackError = "O assistente não respondeu. Tente de novo em instantes.";
const offline = "Sem conexão com o Console agora. Tente de novo em instantes.";

/**
 * Only the new message, the screen and the conversation's id go to the
 * server: earlier turns come from the saved conversation there, never from
 * this tab.
 */
const transport = new DefaultChatTransport<AssistantMessage>({
  api: "/api/assistente",
  prepareSendMessagesRequest: ({ messages, body }) => ({
    body: { message: messageText(messages.at(-1)), page: body?.page, conversationId: body?.conversationId },
  }),
});

/**
 * What the person reads when a turn did not finish. A refusal before the
 * turn (limits, an unreadable message) carries the server's own words; an
 * error the server streamed is already written for the person.
 */
function failureOf(error: Error | undefined) {
  if (!error) return "A resposta chegou incompleta. Tente de novo.";
  if (APICallError.isInstance(error)) return refusalText(error.responseBody) ?? fallbackError;
  // The request never reached the Console, or the connection dropped.
  if (error instanceof TypeError) return offline;
  // Anything else the SDK raised (a part this tab could not read) is not for the person.
  if (AISDKError.isInstance(error)) return fallbackError;
  return error.message || fallbackError;
}

/** A conversation saved on the server, as this tab shows it. */
const fromSaved = (m: SavedMessage): AssistantMessage => ({
  id: m.id,
  role: m.role,
  parts: [...(m.steps?.length ? [{ type: "data-steps" as const, id: "steps", data: m.steps }] : []), { type: "text" as const, text: m.content }],
});

/** The cards of a message, each checked (`readCard`). */
const cardsOf = (message: AssistantMessage) => message.parts.flatMap((part) => (part.type === "data-proposal" ? [readCard(part.data)].filter((card) => card !== null) : []));

/** The chips of a message: the last version of its steps. */
function stepsOf(message: AssistantMessage) {
  let steps: string[] | undefined;
  for (const part of message.parts) if (part.type === "data-steps") steps = part.data;
  return steps;
}

// Read in event handlers only (the compiler's purity rule can't tell them from render).
const clock = () => Date.now();

const tokenCount = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
/** "8 s · 3,4 mil tokens" */
function spentLabel(ms: number, tokens: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const time = seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  return tokens ? `${time} · ${tokenCount.format(tokens)} tokens` : time;
}

/** The live row while the assistant works: the orb, the clock and the tokens so far. */
function Working({ startedAt, tokens, activity }: { startedAt: number; tokens: number; activity: AssistantActivity }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const tick = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(tick);
  }, []);
  return (
    <li className="reveal-fade flex items-center gap-3 text-xs text-muted-foreground">
      <AiOrb state={activity} size="md" decorative />
      <span className="tabular-nums" aria-hidden="true">
        {spentLabel(now - startedAt, tokens)}
      </span>
      <span className="sr-only" aria-live="polite">
        Pensando
      </span>
    </li>
  );
}

// Wide screens have room for the assistant beside the page.
const wideQuery = "(min-width: 1024px)";
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(wideQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getWide = () => window.matchMedia(wideQuery).matches;
const getServerWide = () => false;

/** One card: what will happen, with the data, and the buttons that decide it. */
function ProposalCard({
  proposal,
  fresh,
  onConfirm,
  onDismiss,
}: {
  proposal: ProposalState;
  /** Arrived while the panel was open: it rises in once. */
  fresh: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const open = proposal.status === "pending" || proposal.status === "busy";
  return (
    <div className={cn("mt-2 rounded-xl border bg-card px-4 py-3 text-sm", fresh && "reveal")}>
      <p className="m-0 font-medium text-foreground">{proposal.title}</p>
      {proposal.tainted && open && (
        <p className="m-0 mt-1 flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          Preparado depois de ler texto escrito por outra pessoa (um chamado, um comentário). Confira cada dado antes de confirmar.
        </p>
      )}
      {proposal.details.length > 0 && (
        <dl className="m-0 mt-2 flex flex-col gap-1.5">
          {proposal.details.map((detail, index) => (
            <div key={index} className="grid gap-0.5 sm:grid-cols-[minmax(0,9rem)_1fr] sm:gap-3">
              <dt className="text-xs text-muted-foreground">{detail.label}</dt>
              <dd className="m-0 max-h-40 overflow-y-auto text-xs break-words whitespace-pre-wrap text-foreground">{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {proposal.path && open && <p className="m-0 mt-2 text-xs text-muted-foreground">Vale para a tela {proposal.path}.</p>}
      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onConfirm} disabled={proposal.status === "busy"}>
            <CheckIcon />
            {proposal.status === "busy" ? "Fazendo…" : "Confirmar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss} disabled={proposal.status === "busy"}>
            Descartar
          </Button>
        </div>
      ) : (
        <p
          role="status"
          className={cn(
            "m-0 mt-2 flex items-start gap-1.5 text-xs",
            proposal.status === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {proposal.status === "done" ? (
            <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" />
          ) : proposal.status === "dismissed" ? (
            <CircleSlashIcon className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          )}
          {proposal.message}
        </p>
      )}
    </div>
  );
}

function suggestionsFor(admin: boolean, finance: boolean, support: boolean) {
  if (admin)
    return [
      "Quais faturas estão vencidas?",
      "Quais chamados estão abertos?",
      "Monte um projeto com tarefas para um site institucional",
      "Me dê um resumo de uma empresa",
    ];
  return [
    finance ? "Qual é o meu último boleto?" : "Como estão meus projetos?",
    support ? "Quero abrir um chamado" : "Quais produtos eu tenho?",
    finance
      ? "Tenho algum orçamento aguardando resposta?"
      : "O que a Anuntech faz?",
    "Quero falar com alguém da Anuntech",
  ];
}

/**
 * The Console's assistant: a conversation that reads and acts on the
 * person's own data through the API, which runs every tool with their
 * permissions. Lives next to the dock, keeps the thread while the app
 * navigates, and hands off to the human support chat when asked. The answer
 * streams in as it is written (AI SDK useChat over /api/assistente).
 *
 * On wide screens it moves beside the page while it works, so the person
 * keeps using the Console; closed, it keeps working and says when it's done.
 */
export function AssistantPanel({
  open,
  onOpenChange,
  admin,
  finance,
  support,
  userName,
  shortcuts,
  onActivityChange,
  voice = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lets the dock show what the assistant is doing, also while closed. */
  onActivityChange?: (activity: AssistantActivity) => void;
  admin: boolean;
  finance: boolean;
  support: boolean;
  userName: string;
  shortcuts: AssistantShortcut[];
  /** Dictation by microphone in the composer (lib/voice). */
  voice?: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState<{ startedAt: number; tokens: number; phase: TurnPhase | null } | null>(null);
  // Cards and timings by id: the messages themselves come from the chat.
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [spent, setSpent] = useState<Record<string, { ms: number; tokens: number }>>({});
  // How the last turn (or confirmed card) ended. Seen in the open panel, it shows for a few seconds;
  // unseen, the dock keeps it until the panel opens.
  const [settled, setSettled] = useState<{ kind: "done" | "error"; seen: boolean } | null>(null);
  // Only while the panel is open: closing it unmounts the composer, which reports idle on the way out.
  const [dictation, setDictation] = useState<DictationActivity>("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [history, setHistory] = useState<Conversation[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // A conversation being deleted: until the server answers, nothing else sends, opens or deletes, or it
  // could land in the thread being cleared.
  const [removing, setRemoving] = useState<string | null>(null);
  const removingRef = useRef<string | null>(null);
  // A conversation being opened: deleting it meanwhile would leave the deleted thread on screen.
  const openingRef = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Follows the answer as it streams, unless the person scrolled up to read.
  const stick = useRef(true);
  const wide = useSyncExternalStore(subscribeWide, getWide, getServerWide);
  const [docked, setDocked] = useState(false);
  // Centered by hand: sending stops moving it aside until it is moved back.
  const [keepCentered, setKeepCentered] = useState(false);
  const side = docked && wide;
  // Read after an answer arrives, when the render that started the request is stale.
  const live = useRef({ open, side });
  useEffect(() => {
    live.current = { open, side };
  }, [open, side]);
  // The request under way: when it started, the tokens so far and what it asks of the page at the end.
  const request = useRef<{ startedAt: number; tokens: number; actions: PageAction[]; error?: Error }>({ startedAt: 0, tokens: 0, actions: [] });
  const sending = useRef(false);

  const { messages, setMessages, sendMessage, status } = useChat<AssistantMessage>({
    transport,
    // The data parts are read through readPhase, readActions and readCard (assistant-stream.ts).
    messageMetadataSchema: assistantMetadataSchema,
    // Text arrives in many small pieces; repaint at most every 50 ms.
    throttle: 50,
    onData: (part) => {
      if (part.type === "data-phase") {
        const { phase, tokens } = readPhase(part.data);
        if (tokens !== null) request.current.tokens = tokens;
        setWorking((current) => (current ? { ...current, tokens: tokens ?? current.tokens, phase } : current));
      } else if (part.type === "data-actions") request.current.actions = readActions(part.data);
    },
    onError: (error) => {
      request.current.error = error;
    },
    onFinish: ({ message, isAbort, isError, finishReason }) => finish(message, isAbort, isError, finishReason),
  });
  const busy = status === "submitted" || status === "streaming";
  // Turns already there when the panel opened (or a conversation loaded) stay still; only the ones that
  // arrive while it is open rise in. Closing the panel unmounts the thread, so without this every
  // reopening would replay the whole conversation.
  const [still, setStill] = useState(() => ({ open, ids: new Set(messages.map((m) => m.id)) }));
  if (still.open !== open) setStill({ open, ids: new Set(messages.map((m) => m.id)) });
  const fresh = (id: string) => !still.ids.has(id);

  const turns: Turn[] = messages.map((message) => ({
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: messageText(message),
    steps: stepsOf(message),
    failed: message.metadata?.failed,
    spent: spent[message.id],
    proposals: cardsOf(message).flatMap((card) => (cards[card.id] ? [{ ...card, ...cards[card.id] }] : [])),
  }));
  const activity = assistantActivity({
    busy,
    phase: working?.phase ?? null,
    confirming: turns.some((turn) => turn.proposals?.some((p) => p.status === "busy")),
    pending: turns.some((turn) => turn.proposals?.some((p) => p.status === "pending")),
    settled: settled?.kind ?? null,
    dictation,
  });
  useEffect(() => onActivityChange?.(activity), [activity, onActivityChange]);
  // Opening the panel shows how the turn ended: from then on it is seen, even if the panel closes again.
  if (open && settled && !settled.seen) setSettled({ ...settled, seen: true });
  useEffect(() => {
    if (!settled?.seen) return;
    const timer = setTimeout(() => setSettled(null), 4000);
    return () => clearTimeout(timer);
  }, [settled]);
  // A card the person never answered expires on the server; here it stops waiting too.
  const expireCards = (limit: number) =>
    setCards((current) => {
      let changed = false;
      const next = { ...current };
      for (const [id, card] of Object.entries(current))
        if (card.status === "pending" && card.deadline <= limit) {
          next[id] = { ...card, status: "failed", message: "Este cartão expirou. Peça de novo ao assistente." };
          changed = true;
        }
      return changed ? next : current;
    });
  const nextDeadline = turns
    .flatMap((turn) => turn.proposals ?? [])
    .filter((p) => p.status === "pending")
    .reduce<number | null>((soonest, p) => (soonest === null || p.deadline < soonest ? p.deadline : soonest), null);
  // The timer expires exactly the cards it was armed for, so firing a moment early leaves none behind.
  useEffect(() => {
    if (nextDeadline === null) return;
    const timer = setTimeout(() => expireCards(nextDeadline), Math.max(0, nextDeadline - clock()));
    return () => clearTimeout(timer);
  }, [nextDeadline]);
  // Timers stop while the computer sleeps: coming back to the tab checks again.
  useEffect(() => {
    if (nextDeadline === null) return;
    const check = () => {
      if (document.visibilityState === "visible") expireCards(clock());
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [nextDeadline]);
  // The page makes room for the panel instead of hiding under it.
  useEffect(() => {
    const root = document.documentElement;
    if (open && side) root.dataset.assistantDocked = "";
    else delete root.dataset.assistantDocked;
    return () => {
      delete root.dataset.assistantDocked;
    };
  }, [open, side]);
  const firstName = userName.trim().split(/\s+/)[0] || "";

  const remember = (id: string | null) => {
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode or blocked storage: the thread still lives in this tab */
    }
  };
  /** Another conversation on screen: the cards and timings of the one before go with it. */
  const showMessages = (next: AssistantMessage[]) => {
    setMessages(next);
    setStill((current) => ({ ...current, ids: new Set(next.map((m) => m.id)) }));
    setCards({});
    setSpent({});
    stick.current = true;
  };
  // A turn under way keeps its thread: switching away would drop its question and mix the threads.
  const openConversation = async (id: string) => {
    if (busy || sending.current || removingRef.current || openingRef.current) return false;
    openingRef.current = id;
    let data: { id: string; messages: SavedMessage[] };
    try {
      const res = await fetch(`/api/assistente/conversas/${id}`);
      if (!res.ok || sending.current) return false;
      data = (await res.json()) as { id: string; messages: SavedMessage[] };
    } catch {
      return false;
    } finally {
      openingRef.current = null;
    }
    if (sending.current || removingRef.current) return false;
    showMessages(data.messages.map(fromSaved));
    setConversationId(data.id);
    remember(data.id);
    setView("chat");
    return true;
  };
  const startNew = () => {
    showMessages([]);
    setSettled(null);
    setConversationId(null);
    remember(null);
    setView("chat");
  };
  const showHistory = async () => {
    setView("history");
    setConfirmDelete(null);
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/assistente/conversas");
      const data = (await res.json().catch(() => null)) as {
        conversations?: Conversation[];
      } | null;
      setHistory(data?.conversations ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };
  const removeConversation = async (id: string) => {
    if (busy || sending.current || removingRef.current || openingRef.current) return;
    const current = conversationId === id;
    removingRef.current = id;
    setRemoving(id);
    let res: Response;
    try {
      res = await fetch(`/api/assistente/conversas/${id}`, {
        method: "DELETE",
      });
    } catch {
      res = Response.error();
    } finally {
      removingRef.current = null;
      setRemoving(null);
    }
    if (!res.ok) {
      toast.error("Não foi possível apagar a conversa.");
      return;
    }
    setHistory((list) => list?.filter((c) => c.id !== id) ?? null);
    setConfirmDelete(null);
    if (current && !sending.current) {
      showMessages([]);
      setConversationId(null);
      remember(null);
    }
  };

  // A reload keeps the thread: the last conversation of this tab comes back from the server.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (!stored) return;
    fetch(`/api/assistente/conversas/${stored}`)
      .then(async (res) => {
        if (!res.ok) return remember(null);
        const data = (await res.json()) as { id: string; messages: SavedMessage[] };
        // A message sent before the saved thread arrived wins: the thread stays the one under way.
        let restored = false;
        setMessages((current) => {
          if (sending.current || current.length) return current;
          restored = true;
          return data.messages.map(fromSaved);
        });
        if (!restored) return;
        stick.current = true;
        setConversationId(data.id);
      })
      .catch(() => undefined);
    // setMessages is stable for the panel's life: this runs once.
  }, [setMessages]);

  // Opening the panel starts at the latest message.
  useEffect(() => {
    if (open) stick.current = true;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const node = scroller.current;
    // An empty thread starts at the greeting; a phone may need to scroll to the suggestions.
    if (node && stick.current && messages.length) node.scrollTop = node.scrollHeight;
  }, [messages, working, open, side, view]);
  const followScroll = () => {
    const node = scroller.current;
    if (node) stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
  };

  const close = () => onOpenChange(false);
  // Beside the page the panel stays while the page changes; centered, it gets out of the way.
  const leave = () => {
    if (!live.current.side) close();
  };
  const go = (href: string) => {
    leave();
    router.push(href);
  };
  const toggleSide = () => {
    setKeepCentered(side);
    setDocked(!side);
  };

  // The answer arrived while the panel was closed: say so, one tap away.
  const announce = (failed: boolean) => {
    if (live.current.open) return;
    const show = { label: "Ver", onClick: () => onOpenChange(true) };
    if (failed) toast.error("O assistente não conseguiu terminar.", { action: show });
    else toast.success("O assistente terminou.", { action: show });
  };

  /**
   * Carries out what an answer or a confirmed card asks of the page. A form
   * is filled only in the form the snapshot named, and only one click per
   * answer reaches the page.
   */
  const applyActions = (actions: PageAction[]) => {
    let delay = 0;
    let clicked = false;
    for (const action of actions) {
      if (action.type === "open_support") {
        close();
        setTimeout(openSupportWidget, 300);
      } else if (action.type === "navigate") go(action.href);
      else if (action.type === "refresh") router.refresh();
      else if (action.type === "fill") {
        leave();
        delay += 300;
        setTimeout(() => {
          const outcome = fillPage(action.form, action.fields, action.submit);
          if (outcome.filled)
            toast.success(
              `${outcome.filled === 1 ? "1 campo preenchido" : `${outcome.filled} campos preenchidos`}${outcome.submitted ? " e enviado" : ". Confira antes de salvar"}.`,
            );
          if (outcome.missing.length)
            toast.error(`Não achei na tela: ${outcome.missing.join(", ")}.`);
        }, delay);
      } else if (action.type === "click" && !clicked) {
        clicked = true;
        leave();
        delay += 400;
        setTimeout(() => {
          const outcome = clickPage(action.text);
          if (outcome === "missing") toast.error(`Não achei o botão "${action.text}" na tela.`);
          else if (outcome === "ambiguous") toast.error(`Há mais de um botão "${action.text}" na tela. Clique você no certo.`);
        }, delay);
      }
    }
  };

  const updateCard = (id: string, change: Partial<CardState>) =>
    setCards((current) => (current[id] ? { ...current, [id]: { ...current[id], ...change } } : current));

  /** The person's click: the only way a change the assistant prepared happens. */
  const decide = async (proposal: ProposalState, decisao: "confirmar" | "descartar") => {
    if (proposal.status !== "pending") return;
    // A screen action is about the page it was prepared on.
    if (decisao === "confirmar" && proposal.path && location.pathname !== proposal.path) {
      toast.error(`Esta ação é da tela ${proposal.path}. Abra essa tela e confirme de novo.`);
      return;
    }
    updateCard(proposal.id, { status: "busy" });
    try {
      const res = await fetch(`/api/assistente/propostas/${proposal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce: proposal.nonce, decisao }),
      });
      if (decisao === "descartar") {
        updateCard(proposal.id, res.ok ? { status: "dismissed", message: "Descartado." } : { status: "failed", message: "Esta confirmação não está mais pendente." });
        return;
      }
      const data = (await res.json().catch(() => null)) as { summary?: string; actions?: PageAction[]; error?: string } | null;
      if (!res.ok || !data?.summary) {
        updateCard(proposal.id, { status: "failed", message: data?.error || "Não deu certo. Tente de novo em instantes." });
        setSettled({ kind: "error", seen: live.current.open });
        return;
      }
      updateCard(proposal.id, { status: "done", message: data.summary });
      setSettled({ kind: "done", seen: live.current.open });
      applyActions(data.actions ?? []);
    } catch {
      updateCard(proposal.id, { status: "pending" });
      toast.error("Sem conexão com o Console agora. Tente de novo em instantes.");
    }
  };

  /**
   * A turn that did not finish: what the person reads in its place. A failure on the server saves
   * nothing; after a dropped connection the server may still finish and save it (Histórico shows it).
   */
  const fail = (message: AssistantMessage | undefined, text: string) => {
    setMessages((current) => [
      ...current.filter((m) => m.role !== "assistant" || m.id !== message?.id),
      { id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text }], metadata: { failed: true } },
    ]);
    setSettled({ kind: "error", seen: live.current.open });
    announce(true);
  };

  /** The turn ended, one way or another. */
  function finish(message: AssistantMessage, isAbort: boolean, isError: boolean, finishReason: string | undefined) {
    const { startedAt, tokens, actions, error } = request.current;
    sending.current = false;
    setWorking(null);
    // Only when the panel itself went away; the server finishes and saves the turn anyway.
    if (isAbort) return;
    if (isError || finishReason !== "stop" || message.role !== "assistant") {
      fail(message, failureOf(isError ? error : undefined));
      return;
    }
    const metadata = message.metadata ?? {};
    setSpent((current) => ({ ...current, [message.id]: { ms: clock() - startedAt, tokens: metadata.tokens ?? tokens } }));
    const deadline = startedAt + PROPOSAL_TTL_MS;
    const fresh = cardsOf(message).map((card) => card.id);
    if (fresh.length) setCards((current) => ({ ...current, ...Object.fromEntries(fresh.map((id) => [id, { status: "pending" as const, deadline }])) }));
    if (metadata.conversationId) {
      setConversationId(metadata.conversationId);
      remember(metadata.conversationId);
    }
    setSettled({ kind: "done", seen: live.current.open });
    announce(false);
    // Closed, the person moved on to something else: only refresh what it
    // changed, never take them to another page or type into their screen.
    applyActions(live.current.open ? actions : actions.filter((action) => action.type === "refresh"));
  }

  const send = (text: string) => {
    if (busy || sending.current || removingRef.current || !text.trim()) return;
    const message = text.trim();
    sending.current = true;
    setSettled(null);
    const startedAt = clock();
    request.current = { startedAt, tokens: 0, actions: [] };
    setWorking({ startedAt, tokens: 0, phase: null });
    stick.current = true;
    if (!keepCentered && getWide()) setDocked(true);
    // Reading the screen is a bonus: if it fails, the message still goes, without it.
    let page: ReturnType<typeof snapshotPage> | undefined;
    try {
      page = snapshotPage();
      JSON.stringify(page);
    } catch (error) {
      console.warn("[assistant] could not read the screen", error);
      page = undefined;
    }
    sendMessage({ text: message }, { body: { page, conversationId: conversationId ?? undefined } }).catch((error) =>
      console.warn("[assistant] turn not finished", error),
    );
  };

  // Beside the page the composer is narrower: two shortcuts fit without scrolling.
  const chips = shortcuts.slice(0, side ? 2 : 3).map((s) => s.label);
  return (
    // Beside the page it isn't modal: no scrim, and the page stays clickable.
    <Dialog open={open} onOpenChange={onOpenChange} modal={!side}>
      <DialogContent
        data-assistant=""
        className={cn(
          "flex translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0",
          side
            ? "top-3 right-(--assistant-right) bottom-3 left-auto h-auto w-[400px] max-w-none rounded-2xl shadow-float data-[state=closed]:zoom-out-100 data-[state=closed]:slide-out-to-right-8 data-[state=open]:zoom-in-100 data-[state=open]:slide-in-from-right-8"
            : "top-auto bottom-0 left-0 h-[min(720px,88svh)] w-full max-w-none rounded-t-2xl rounded-b-none sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-[min(720px,calc(100svh-128px))] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:duration-(--anu-motion-slow) max-sm:data-[state=closed]:duration-(--anu-motion-base)",
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (side) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          // Escape in the page belongs to the page; only Escape in the panel closes it.
          const target = event.target instanceof Element ? event.target : null;
          if (side && !target?.closest("[data-assistant]")) event.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">Assistente</DialogTitle>
        <DialogDescription className="sr-only">
          Consulta e faz por você: faturas, chamados, projetos, contratos e
          orçamentos.
        </DialogDescription>
        <div className="flex h-12 shrink-0 items-center justify-end gap-1 pr-12 pl-4">
          {view === "history" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mr-auto text-muted-foreground"
              onClick={() => setView("chat")}
            >
              <ArrowLeftIcon />
              Voltar
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={showHistory}
              disabled={busy}
            >
              <HistoryIcon />
              Histórico
            </Button>
          )}
          {turns.length > 0 && view === "chat" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={startNew}
              disabled={busy}
            >
              <RotateCcwIcon />
              Nova conversa
            </Button>
          )}
          {wide && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={side ? "Centralizar o assistente" : "Mover o assistente para o lado"}
              title={side ? "Centralizar" : "Mover para o lado"}
              onClick={toggleSide}
            >
              {side ? <Maximize2Icon /> : <PanelRightIcon />}
            </Button>
          )}
        </div>

        {view === "history" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5">
            <p className="m-0 mb-3 text-caption font-medium text-muted-foreground">
              Suas conversas
            </p>
            {loadingHistory && !history ? (
              <p className="m-0 text-sm text-muted-foreground">Carregando…</p>
            ) : history && history.length ? (
              <ul className="m-0 flex list-none flex-col p-0 divide-y">
                {history.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-1">
                    <button
                      type="button"
                      disabled={busy || removing !== null}
                      onClick={() => openConversation(c.id)}
                      className={cn(
                        "flex min-w-0 flex-1 flex-col rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary",
                        c.id === conversationId && "bg-accent/60",
                      )}
                    >
                      <span className="truncate text-sm font-medium text-foreground">
                        {c.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {relativeLabel(c.updatedAt, new Date().toISOString())} ·{" "}
                        {c.messages}{" "}
                        {c.messages === 1 ? "mensagem" : "mensagens"}
                      </span>
                    </button>
                    {confirmDelete === c.id ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={busy || removing !== null}
                        onClick={() => removeConversation(c.id)}
                      >
                        Apagar?
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Apagar "${c.title}"`}
                        className="text-muted-foreground"
                        disabled={busy || removing !== null}
                        onClick={() => setConfirmDelete(c.id)}
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                Nenhuma conversa guardada ainda. As próximas ficam aqui.
              </p>
            )}
          </div>
        ) : (
          <div
            ref={scroller}
            onScroll={followScroll}
            className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5"
          >
            {turns.length === 0 ? (
              // min-h-full, not h-full: content taller than a phone's panel must stay reachable by scrolling.
              <div className="flex min-h-full flex-col justify-end gap-5">
                <div className="reveal">
                  <AiOrb state={activity} size="lg" decorative className="mb-4" />
                  <p className="m-0 text-title text-foreground">
                    {firstName ? `Olá, ${firstName}.` : "Olá."} Como posso
                    ajudar?
                  </p>
                  <p className="m-0 mt-1.5 max-w-[52ch] text-sm text-pretty text-muted-foreground">
                    Peça em português, como falaria com alguém da equipe. Eu uso
                    o seu acesso e nunca vejo o que você não veria.
                  </p>
                </div>
                <ul className="stagger m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                  {suggestionsFor(admin, finance, support).map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => send(suggestion)}
                        className="press h-full w-full rounded-xl border bg-card px-4 py-3 text-left text-sm text-foreground hover:border-field-hover hover:bg-secondary"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
                {shortcuts.length > chips.length && (
                  <div>
                    <p className="m-0 mb-2 text-caption font-medium text-muted-foreground">
                      Mais atalhos
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {shortcuts.slice(chips.length).map((s) => (
                        <Button
                          key={s.href}
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link href={s.href} onClick={leave}>
                            {s.label}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {turns.map((turn) =>
                  // An answer only shows once something of it arrived: chips, text or a card.
                  turn.role === "assistant" && !turn.content && !turn.steps?.length && !turn.proposals?.length ? null : turn.role === "user" ? (
                    <li key={turn.id} className={cn("flex justify-end", fresh(turn.id) && "reveal [--rise:10px]")}>
                      <p className="m-0 max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap text-primary-foreground">
                        {turn.content}
                      </p>
                    </li>
                  ) : (
                    <li key={turn.id} className={cn("flex gap-3", fresh(turn.id) && "reveal-fade")}>
                      {/* The orb shows only while it works; a failure keeps its warning. */}
                      {turn.failed && (
                        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive-soft text-destructive">
                          <TriangleAlertIcon className="size-3.5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        {turn.steps && turn.steps.length > 0 && (
                          <ul className="m-0 mb-2 flex list-none flex-wrap gap-1.5 p-0">
                            {turn.steps.map((step, i) => (
                              <li
                                key={i}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-caption text-muted-foreground",
                                  fresh(turn.id) && "reveal-fade",
                                )}
                              >
                                <CheckIcon className="size-3 text-success" />
                                {step}
                              </li>
                            ))}
                          </ul>
                        )}
                        {turn.failed ? (
                          <p className="m-0 text-sm text-destructive">
                            {turn.content}
                          </p>
                        ) : (
                          <MessageMarkdown
                            text={turn.content}
                            onNavigate={leave}
                          />
                        )}
                        {turn.proposals?.map((proposal) => (
                          <ProposalCard
                            key={proposal.id}
                            proposal={proposal}
                            fresh={fresh(turn.id)}
                            onConfirm={() => decide(proposal, "confirmar")}
                            onDismiss={() => decide(proposal, "descartar")}
                          />
                        ))}
                        {turn.spent && (
                          <p className="m-0 mt-1.5 text-caption text-muted-foreground tabular-nums">
                            {spentLabel(turn.spent.ms, turn.spent.tokens)}
                          </p>
                        )}
                      </div>
                    </li>
                  ),
                )}
                {working && (
                  <Working
                    startedAt={working.startedAt}
                    tokens={working.tokens}
                    activity={assistantActivity({ busy: true, phase: working.phase, confirming: false, pending: false, settled: null, dictation: "idle" })}
                  />
                )}
              </ol>
            )}
          </div>
        )}

        <div className="border-t bg-background px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <MetalPromptBar
            autoFocus
            busy={busy || removing !== null}
            dictation={voice}
            onDictationChange={setDictation}
            chips={chips}
            onChipClick={(label) => {
              const target = shortcuts.find((s) => s.label === label);
              if (target) go(target.href);
            }}
            onSubmit={send}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
