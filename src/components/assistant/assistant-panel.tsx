"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { cn } from "cn";
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
import { assistantActivity, TURN_PHASES, type AssistantActivity, type DictationActivity, type TurnPhase } from "@/lib/assistant/activity";
import { MessageMarkdown } from "./message-markdown";
import { clickPage, fillPage, snapshotPage } from "./page-bridge";

export type AssistantShortcut = { href: string; label: string };
/** A change the assistant prepared; it runs only when the person confirms it here. */
type Proposal = {
  id: string;
  nonce: string;
  title: string;
  details: { label: string; value: string }[];
  tainted: boolean;
  path: string | null;
  expiresAt: string;
};
type ProposalState = Proposal & {
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
type PageAction =
  | { type: "navigate"; href: string }
  | { type: "open_support" }
  | { type: "fill"; form: string; fields: { campo: string; valor: string }[]; submit: boolean }
  | { type: "click"; text: string }
  | { type: "refresh" };
type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: number;
};
const STORAGE_KEY = "assistant:conversation";

const fallbackError = "O assistente não respondeu. Tente de novo em instantes.";

/**
 * Reads a turn as it streams: progress lines report the tokens spent so far
 * and where the turn is, then one line carries the reply or the error.
 * Refusals before the turn starts come back as plain JSON.
 */
async function readTurn(
  res: Response,
  onProgress: (tokens: number, phase: TurnPhase | null) => void,
): Promise<Reply | { error: string }> {
  if (!res.body || !res.headers.get("content-type")?.includes("ndjson")) {
    const data = (await res.json().catch(() => null)) as (Reply & { error?: string }) | null;
    return res.ok && data && !data.error ? data : { error: data?.error || fallbackError };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Reply | { error: string } | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (!line) continue;
      let event: { type?: string; tokens?: number; phase?: TurnPhase; error?: string } & Partial<Reply>;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      // A phase this tab does not know (a newer server) reads as plain thinking.
      if (event.type === "progress")
        onProgress(event.tokens ?? 0, event.phase && TURN_PHASES.includes(event.phase) ? event.phase : null);
      else if (event.type === "done") result = event as Reply;
      else if (event.type === "error") result = { error: event.error || fallbackError };
    }
    if (done) break;
  }
  return result ?? { error: "A resposta chegou incompleta. Tente de novo." };
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
    <li className="flex items-center gap-3 text-xs text-muted-foreground">
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

type Reply = {
  reply: string;
  tokens?: number;
  steps: string[];
  conversationId?: string | null;
  actions: PageAction[];
  proposals?: Proposal[];
};

/** One card: what will happen, with the data, and the buttons that decide it. */
function ProposalCard({
  proposal,
  onConfirm,
  onDismiss,
}: {
  proposal: ProposalState;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const open = proposal.status === "pending" || proposal.status === "busy";
  return (
    <div className="mt-2 rounded-xl border bg-card px-4 py-3 text-sm">
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
 * navigates, and hands off to the human support chat when asked.
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
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<{ startedAt: number; tokens: number; phase: TurnPhase | null } | null>(null);
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
  const scroller = useRef<HTMLDivElement>(null);
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
  const expireCards = (limit: number) => {
    const expired = (p: ProposalState) => p.status === "pending" && p.deadline <= limit;
    setTurns((current) =>
      current.map((turn) =>
        turn.proposals?.some(expired)
          ? {
              ...turn,
              proposals: turn.proposals.map((p) =>
                expired(p) ? { ...p, status: "failed" as const, message: "Este cartão expirou. Peça de novo ao assistente." } : p,
              ),
            }
          : turn,
      ),
    );
  };
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
  const openConversation = async (id: string) => {
    const res = await fetch(`/api/assistente/conversas/${id}`);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      id: string;
      messages: {
        id: string;
        role: "user" | "assistant";
        content: string;
        steps?: string[];
      }[];
    };
    setTurns(
      data.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        steps: m.steps,
      })),
    );
    setConversationId(data.id);
    remember(data.id);
    setView("chat");
    return true;
  };
  const startNew = () => {
    setTurns([]);
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
    const res = await fetch(`/api/assistente/conversas/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Não foi possível apagar a conversa.");
      return;
    }
    setHistory((current) => current?.filter((c) => c.id !== id) ?? null);
    setConfirmDelete(null);
    if (conversationId === id) {
      setTurns([]);
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
        const data = (await res.json()) as {
          id: string;
          messages: {
            id: string;
            role: "user" | "assistant";
            content: string;
            steps?: string[];
          }[];
        };
        setTurns(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            steps: m.steps,
          })),
        );
        setConversationId(data.id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    const node = scroller.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [turns, busy, open, side]);

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

  const updateProposal = (id: string, change: Partial<ProposalState>) =>
    setTurns((current) =>
      current.map((turn) =>
        turn.proposals?.some((p) => p.id === id)
          ? { ...turn, proposals: turn.proposals.map((p) => (p.id === id ? { ...p, ...change } : p)) }
          : turn,
      ),
    );

  /** The person's click: the only way a change the assistant prepared happens. */
  const decide = async (proposal: ProposalState, decisao: "confirmar" | "descartar") => {
    if (proposal.status !== "pending") return;
    // A screen action is about the page it was prepared on.
    if (decisao === "confirmar" && proposal.path && location.pathname !== proposal.path) {
      toast.error(`Esta ação é da tela ${proposal.path}. Abra essa tela e confirme de novo.`);
      return;
    }
    updateProposal(proposal.id, { status: "busy" });
    try {
      const res = await fetch(`/api/assistente/propostas/${proposal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce: proposal.nonce, decisao }),
      });
      if (decisao === "descartar") {
        updateProposal(proposal.id, res.ok ? { status: "dismissed", message: "Descartado." } : { status: "failed", message: "Esta confirmação não está mais pendente." });
        return;
      }
      const data = (await res.json().catch(() => null)) as { summary?: string; actions?: PageAction[]; error?: string } | null;
      if (!res.ok || !data?.summary) {
        updateProposal(proposal.id, { status: "failed", message: data?.error || "Não deu certo. Tente de novo em instantes." });
        setSettled({ kind: "error", seen: live.current.open });
        return;
      }
      updateProposal(proposal.id, { status: "done", message: data.summary });
      setSettled({ kind: "done", seen: live.current.open });
      applyActions(data.actions ?? []);
    } catch {
      updateProposal(proposal.id, { status: "pending" });
      toast.error("Sem conexão com o Console agora. Tente de novo em instantes.");
    }
  };

  const send = async (text: string) => {
    if (busy || !text.trim()) return;
    const message = text.trim();
    setTurns((current) => [...current, { id: crypto.randomUUID(), role: "user" as const, content: message }]);
    setBusy(true);
    setSettled(null);
    const startedAt = clock();
    let spentTokens = 0;
    setWorking({ startedAt, tokens: 0, phase: null });
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
    try {
      // Earlier turns come from the saved conversation on the server, never from this tab.
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          page,
          conversationId: conversationId ?? undefined,
        }),
      });
      const data = await readTurn(res, (tokens, phase) => {
        spentTokens = tokens;
        setWorking({ startedAt, tokens, phase });
      });
      if ("error" in data) {
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.error,
            failed: true,
          },
        ]);
        setSettled({ kind: "error", seen: live.current.open });
        announce(true);
        return;
      }
      const reply = data;
      setTurns((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply.reply,
          steps: reply.steps,
          spent: { ms: clock() - startedAt, tokens: reply.tokens ?? spentTokens },
          proposals: reply.proposals?.map((p) => ({ ...p, status: "pending" as const, deadline: startedAt + PROPOSAL_TTL_MS })),
        },
      ]);
      if (reply.conversationId) {
        setConversationId(reply.conversationId);
        remember(reply.conversationId);
      }
      setSettled({ kind: "done", seen: live.current.open });
      announce(false);
      // Closed, the person moved on to something else: only refresh what it
      // changed, never take them to another page or type into their screen.
      applyActions(
        live.current.open
          ? reply.actions
          : reply.actions.filter((action) => action.type === "refresh"),
      );
    } catch {
      setTurns((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Sem conexão com o Console agora. Tente de novo em instantes.",
          failed: true,
        },
      ]);
      setSettled({ kind: "error", seen: live.current.open });
      announce(true);
    } finally {
      setBusy(false);
      setWorking(null);
    }
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
            ? "top-3 right-(--assistant-right) bottom-3 left-auto h-auto w-[400px] max-w-none rounded-2xl shadow-xl data-[state=closed]:zoom-out-100 data-[state=closed]:slide-out-to-right-8 data-[state=open]:zoom-in-100 data-[state=open]:slide-in-from-right-8"
            : "top-auto bottom-0 left-0 h-[min(720px,88svh)] w-full max-w-none rounded-t-2xl rounded-b-none sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-[min(720px,calc(100svh-128px))] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
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
            <p className="m-0 mb-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
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
                      onClick={() => openConversation(c.id)}
                      className={cn(
                        "flex min-w-0 flex-1 flex-col rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent",
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
            className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5"
          >
            {turns.length === 0 ? (
              <div className="flex h-full flex-col justify-end gap-5">
                <div>
                  <AiOrb state={activity} size="lg" decorative className="mb-3" />
                  <p className="m-0 text-lg font-semibold text-foreground">
                    {firstName ? `Olá, ${firstName}.` : "Olá."} Como posso
                    ajudar?
                  </p>
                  <p className="m-0 mt-1 text-sm text-muted-foreground">
                    Peça em português, como falaria com alguém da equipe. Eu uso
                    o seu acesso e nunca vejo o que você não veria.
                  </p>
                </div>
                <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                  {suggestionsFor(admin, finance, support).map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => send(suggestion)}
                        className="w-full rounded-xl border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
                {shortcuts.length > chips.length && (
                  <div>
                    <p className="m-0 mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
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
                  turn.role === "user" ? (
                    <li key={turn.id} className="flex justify-end">
                      <p className="m-0 max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap text-primary-foreground">
                        {turn.content}
                      </p>
                    </li>
                  ) : (
                    <li key={turn.id} className="flex gap-3">
                      {/* The orb shows only while it works; a failure keeps its warning. */}
                      {turn.failed && (
                        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                          <TriangleAlertIcon className="size-3.5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        {turn.steps && turn.steps.length > 0 && (
                          <ul className="m-0 mb-2 flex list-none flex-wrap gap-1.5 p-0">
                            {turn.steps.map((step, i) => (
                              <li
                                key={i}
                                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
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
                            onConfirm={() => decide(proposal, "confirmar")}
                            onDismiss={() => decide(proposal, "descartar")}
                          />
                        ))}
                        {turn.spent && (
                          <p className="m-0 mt-1.5 text-[11px] text-muted-foreground tabular-nums">
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
            busy={busy}
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
