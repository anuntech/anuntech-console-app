"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, RotateCcwIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MetalPromptBar } from "@/components/ui/metal-prompt-bar";
import { openSupportWidget } from "@/components/support-trigger";
import { toast } from "@/components/notifications";
import { MessageMarkdown } from "./message-markdown";
import { clickPage, fillPage, snapshotPage } from "./page-bridge";

export type AssistantShortcut = { href: string; label: string };
type Turn = { id: string; role: "user" | "assistant"; content: string; steps?: string[]; failed?: boolean };
type Reply = {
  reply: string;
  steps: string[];
  actions: (
    | { type: "navigate"; href: string }
    | { type: "open_support" }
    | { type: "fill"; fields: { campo: string; valor: string }[]; submit: boolean }
    | { type: "click"; text: string }
  )[];
};

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
    finance ? "Tenho algum orçamento aguardando resposta?" : "O que a Anuntech faz?",
    "Quero falar com alguém da Anuntech",
  ];
}

/**
 * The Console's assistant: a conversation that reads and acts on the
 * person's own data through the API, which runs every tool with their
 * permissions. Lives next to the dock, keeps the thread while the app
 * navigates, and hands off to the human support chat when asked.
 */
export function AssistantPanel({
  open,
  onOpenChange,
  admin,
  finance,
  support,
  userName,
  shortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: boolean;
  finance: boolean;
  support: boolean;
  userName: string;
  shortcuts: AssistantShortcut[];
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const firstName = userName.trim().split(/\s+/)[0] || "";

  useEffect(() => {
    if (!open) return;
    const node = scroller.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [turns, busy, open]);

  const close = () => onOpenChange(false);
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const send = async (text: string) => {
    if (busy || !text.trim()) return;
    const history = [...turns, { id: crypto.randomUUID(), role: "user" as const, content: text.trim() }];
    setTurns(history);
    setBusy(true);
    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.filter((t) => !t.failed).map(({ role, content }) => ({ role, content })), page: snapshotPage() }),
      });
      const data = (await res.json().catch(() => null)) as (Reply & { error?: string }) | { error: string } | null;
      if (!res.ok || !data || "error" in data && data.error) {
        const message = (data && "error" in data && data.error) || "O assistente não respondeu. Tente de novo em instantes.";
        setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: message, failed: true }]);
        return;
      }
      const reply = data as Reply;
      setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: reply.reply, steps: reply.steps }]);
      let delay = 0;
      for (const action of reply.actions) {
        if (action.type === "open_support") {
          close();
          setTimeout(openSupportWidget, 300);
        } else if (action.type === "navigate") go(action.href);
        else if (action.type === "fill") {
          close();
          delay += 300;
          setTimeout(() => {
            const outcome = fillPage(action.fields, action.submit);
            if (outcome.filled) toast.success(`${outcome.filled === 1 ? "1 campo preenchido" : `${outcome.filled} campos preenchidos`}${outcome.submitted ? " e enviado" : ". Confira antes de salvar"}.`);
            if (outcome.missing.length) toast.error(`Não achei na tela: ${outcome.missing.join(", ")}.`);
          }, delay);
        } else if (action.type === "click") {
          close();
          delay += 400;
          setTimeout(() => {
            if (!clickPage(action.text)) toast.error(`Não achei o botão "${action.text}" na tela.`);
          }, delay);
        }
      }
    } catch {
      setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "Sem conexão com o Console agora. Tente de novo em instantes.", failed: true }]);
    } finally {
      setBusy(false);
    }
  };

  const chips = shortcuts.slice(0, 3).map((s) => s.label);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-assistant=""
        className="top-auto bottom-0 left-0 flex h-[min(720px,88svh)] w-full max-w-none sm:h-[min(720px,calc(100svh-128px))] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Assistente</DialogTitle>
        <DialogDescription className="sr-only">Consulta e faz por você: faturas, chamados, projetos, contratos e orçamentos.</DialogDescription>
        <div className="flex h-12 shrink-0 items-center justify-end pr-12 pl-4">
          {turns.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setTurns([])} disabled={busy}>
              <RotateCcwIcon />
              Nova conversa
            </Button>
          )}
        </div>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5">
          {turns.length === 0 ? (
            <div className="flex h-full flex-col justify-end gap-5">
              <div>
                <p className="m-0 text-lg font-semibold text-foreground">
                  {firstName ? `Olá, ${firstName}.` : "Olá."} Como posso ajudar?
                </p>
                <p className="m-0 mt-1 text-sm text-muted-foreground">
                  Peça em português, como falaria com alguém da equipe. Eu uso o seu acesso e nunca vejo o que você não veria.
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
              {shortcuts.length > 3 && (
                <div>
                  <p className="m-0 mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Mais atalhos</p>
                  <div className="flex flex-wrap gap-2">
                    {shortcuts.slice(3).map((s) => (
                      <Button key={s.href} type="button" variant="outline" size="sm" asChild>
                        <Link href={s.href} onClick={close}>
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
                    <span
                      className={cn(
                        "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full",
                        turn.failed ? "bg-destructive/10 text-destructive" : "bg-accent text-primary",
                      )}
                    >
                      {turn.failed ? <TriangleAlertIcon className="size-3.5" /> : <SparklesIcon className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      {turn.steps && turn.steps.length > 0 && (
                        <ul className="m-0 mb-2 flex list-none flex-wrap gap-1.5 p-0">
                          {turn.steps.map((step, i) => (
                            <li key={i} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                              <CheckIcon className="size-3 text-success" />
                              {step}
                            </li>
                          ))}
                        </ul>
                      )}
                      {turn.failed ? (
                        <p className="m-0 text-sm text-destructive">{turn.content}</p>
                      ) : (
                        <MessageMarkdown text={turn.content} onNavigate={close} />
                      )}
                    </div>
                  </li>
                ),
              )}
              {busy && (
                <li className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <SparklesIcon className="size-3.5" />
                  </span>
                  <span className="inline-flex items-center gap-1" aria-live="polite">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                    <span className="ml-2">Pensando…</span>
                  </span>
                </li>
              )}
            </ol>
          )}
        </div>

        <div className="border-t bg-background px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <MetalPromptBar
            autoFocus
            busy={busy}
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
