"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { Loader2Icon, PaletteIcon, PlusIcon, RefreshCwIcon, SparklesIcon, SquareIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyButton } from "@/components/console/copy-button";
import { ServerForm, SubmitButton } from "@/components/console/server-form";
import { MessageMarkdown } from "@/components/assistant/message-markdown";
import { toast } from "@/components/shell/notifications";
import { addJourneyStep, saveJourneyAiDraft } from "@/lib/journeys/journey-actions";
import {
  paletteCss,
  stageTitle,
  swatchContrast,
  type DesignDirection,
  type JourneyBriefing,
  type ResolvedStep,
} from "@/lib/journeys/journey-model";

/*
 * The AI next to each step. It only writes drafts: the result shows here,
 * the team reads it and decides what to keep (copy it, put it in the note,
 * or keep it in the journey). Nothing is saved or sent by the AI itself.
 */

type AiBody =
  | { tipo: "briefing"; notas: string; transcricao?: string }
  | { tipo: "prompt" }
  | { tipo: "design"; referencias?: string }
  | { tipo: "pauta"; reuniao: string }
  | { tipo: "passo"; passo: string }
  | { tipo: "retorno"; retorno: string }
  | { tipo: "lacunas" };

export type Gap = { titulo: string; etapa: string; motivo: string };
type AiAnswer = { text?: string; briefing?: JourneyBriefing; design?: DesignDirection; passos?: Gap[]; error?: string };

/** One call to the journey's AI route; the error comes back in the person's words. */
export async function askJourneyAi(journeyId: string, body: AiBody, signal?: AbortSignal): Promise<AiAnswer> {
  const res = await fetch(`/api/jornadas/${journeyId}/sugestao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => null)) as AiAnswer | null;
  if (!res.ok || !data) throw new Error(data?.error || "Não foi possível falar com a IA agora. Tente de novo.");
  return data;
}

/** A pending call that can be cancelled; the button shows what is happening. */
export function useAiCall() {
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const run = async <T,>(work: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPending(true);
    try {
      return await work(current.signal);
    } catch (error) {
      if (!current.signal.aborted) toast.error(error instanceof Error ? error.message : "Não foi possível agora.");
      return null;
    } finally {
      if (controller.current === current) setPending(false);
    }
  };
  const cancel = () => {
    controller.current?.abort();
    setPending(false);
  };
  // Leaving the page cancels the call (it would only spend the hourly limit).
  useEffect(() => () => controller.current?.abort(), []);
  return { pending, run, cancel };
}

/** Markdown with fenced blocks (a folder tree, a command) kept as they are, ready to copy. */
export function AiText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/```[^\n]*\n?/);
  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5", className)}>
      {parts.map((part, index) =>
        !part.trim() ? null : index % 2 ? (
          <pre key={index} className="m-0 overflow-x-auto rounded-md border bg-secondary/60 p-3 font-mono text-xs leading-5 whitespace-pre text-foreground">
            {part.replace(/\n$/, "")}
          </pre>
        ) : (
          <Fragment key={index}>
            {/* Quoted notes ("> …") read as plain sentences: the renderer has no blockquote. */}
            <MessageMarkdown text={part.replace(/^>\s?/gm, "")} />
          </Fragment>
        ),
      )}
    </div>
  );
}

const askLabels: Record<string, { idle: string; pending: string; ready: string }> = {
  prompt: { idle: "Gerar o prompt de início", pending: "Escrevendo o prompt…", ready: "Prompt pronto. Confira antes de copiar." },
  design: { idle: "Propor a direção visual", pending: "Montando a paleta…", ready: "Direção visual pronta. Confira o contraste antes de usar." },
  pauta: { idle: "Preparar a pauta", pending: "Preparando a pauta…", ready: "Pauta pronta. Confira antes de usar." },
  retorno: { idle: "Separar o retorno", pending: "Separando…", ready: "Retorno separado. Confira antes de usar." },
  passo: { idle: "Como fazer este passo", pending: "Escrevendo…", ready: "Orientação pronta. Confira antes de usar." },
};

const radiusLabels: Record<DesignDirection["raio"], string> = { nenhum: "sem arredondamento", pequeno: "pequeno", medio: "médio", grande: "grande" };
const ratio = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** The design direction as text, to keep in the journey and to feed the project prompt. */
function designText(d: DesignDirection) {
  return [
    `Tom: ${d.tom}`,
    `Fontes: ${d.fontes.titulos} nos títulos, ${d.fontes.texto} no texto. Raio: ${radiusLabels[d.raio]}.`,
    d.paleta.map((c) => `- ${c.nome} ${c.hex}: ${c.uso}`).join("\n"),
    `Por quê: ${d.justificativa}`,
    "```css\n" + paletteCss(d) + "\n```",
  ].join("\n\n");
}

function Palette({ design }: { design: DesignDirection }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
        {design.paleta.map((color) => {
          const contrast = swatchContrast(color.hex);
          return (
            <li key={`${color.nome}-${color.hex}`} className="min-w-0 overflow-hidden rounded-lg border">
              <div className="flex h-14 items-end px-2.5 py-1.5 text-xs font-medium" style={{ background: color.hex, color: contrast.text }}>
                Aa
              </div>
              <div className="px-2.5 py-2 text-xs">
                <p className="m-0 truncate font-medium text-foreground">{color.nome}</p>
                <p className="m-0 font-mono text-muted-foreground">{color.hex.toLowerCase()}</p>
                <p className={cn("m-0 mt-0.5", contrast.passes ? "text-muted-foreground" : "text-warning")}>
                  {contrast.passes ? `Texto ${ratio(contrast.ratio)}:1` : `Contraste ${ratio(contrast.ratio)}:1, abaixo de 4,5`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-sm text-foreground">
        {design.fontes.titulos} nos títulos, {design.fontes.texto} no texto, raio {radiusLabels[design.raio]}. {design.tom}
      </p>
      <p className="m-0 text-xs text-muted-foreground">{design.justificativa}</p>
    </div>
  );
}

/** "Pedir ajuda à IA" inside a step: the kind of help comes from the template ("passo" when it names none). */
export function StepAi({
  journeyId,
  step,
  onUseNote,
}: {
  journeyId: string;
  step: ResolvedStep;
  /** Puts the text in the step's note, for the team to edit and save. */
  onUseNote?: (text: string) => void;
}) {
  const ai = step.def.ai && step.def.ai.kind !== "briefing" ? step.def.ai : { kind: "passo" as const };
  const labels = askLabels[ai.kind];
  const { pending, run, cancel } = useAiCall();
  const [answer, setAnswer] = useState<{ text: string; design?: DesignDirection } | null>(null);
  const [input, setInput] = useState("");
  const body = (): AiBody | null => {
    if (ai.kind === "prompt") return { tipo: "prompt" };
    if (ai.kind === "design") return { tipo: "design", referencias: input.trim() || undefined };
    if (ai.kind === "pauta") return { tipo: "pauta", reuniao: ai.meeting };
    if (ai.kind === "retorno") {
      if (!input.trim()) {
        toast.error("Cole o retorno do cliente antes.");
        return null;
      }
      return { tipo: "retorno", retorno: input.trim() };
    }
    return { tipo: "passo", passo: step.def.key };
  };
  const ask = async () => {
    const request = body();
    if (!request) return;
    const result = await run((signal) => askJourneyAi(journeyId, request, signal));
    if (!result) return;
    if (result.design) setAnswer({ text: designText(result.design), design: result.design });
    else if (result.text) setAnswer({ text: result.text });
    else return;
    toast.success(labels.ready);
  };
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-accent/30 p-3">
      {ai.kind === "retorno" && (
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={4}
          maxLength={8000}
          aria-label="Retorno do cliente"
          placeholder="Cole aqui o que o cliente trouxe na apresentação: e-mail, mensagem ou anotações."
        />
      )}
      {ai.kind === "design" && (
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={2000}
          aria-label="Referências visuais"
          placeholder="Referências e cores da marca, se houver (opcional)"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={ask} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : answer ? <RefreshCwIcon /> : ai.kind === "design" ? <PaletteIcon /> : <SparklesIcon />}
          {pending ? labels.pending : answer ? "Gerar de novo" : labels.idle}
        </Button>
        {pending && (
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            <SquareIcon />
            Parar
          </Button>
        )}
        {!pending && !answer && <span className="text-xs text-muted-foreground">A IA escreve um rascunho com o que a jornada já sabe.</span>}
      </div>
      {answer && (
        <div className="flex flex-col gap-3 rounded-md border bg-card p-3">
          {answer.design ? <Palette design={answer.design} /> : <AiText text={answer.text} />}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <CopyButton value={answer.design ? paletteCss(answer.design) : answer.text} label={answer.design ? "CSS da paleta" : "Texto"} variant="outline" size="sm">
              {answer.design ? "Copiar CSS" : "Copiar"}
            </CopyButton>
            {onUseNote && !answer.design && (
              <Button type="button" variant="outline" size="sm" onClick={() => onUseNote(answer.text)}>
                Usar na anotação
              </Button>
            )}
            <ServerForm action={saveJourneyAiDraft} className="contents">
              <input type="hidden" name="journeyId" value={journeyId} />
              <input type="hidden" name="key" value={step.def.key} />
              <input type="hidden" name="kind" value={ai.kind} />
              <input type="hidden" name="text" value={answer.text} />
              <SubmitButton size="sm" variant="outline" pendingLabel="Guardando…">
                Guardar na jornada
              </SubmitButton>
            </ServerForm>
            <span className="text-xs text-muted-foreground">Confira antes de usar.</span>
          </div>
        </div>
      )}
      {step.row?.aiText && !answer && (
        <details className="group rounded-md border bg-card px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Guardado na jornada</summary>
          <div className="mt-2 flex flex-col gap-2">
            <AiText text={step.row.aiText} />
            <CopyButton value={step.row.aiText} label="Texto" variant="outline" size="sm" className="self-start">
              Copiar
            </CopyButton>
          </div>
        </details>
      )}
    </div>
  );
}

/** "O que está faltando?": steps the AI thinks this journey needs, each added with one click. */
export function GapsDialog({ journeyId, open, onOpenChange }: { journeyId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { pending, run } = useAiCall();
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const ask = async () => {
    const result = await run((signal) => askJourneyAi(journeyId, { tipo: "lacunas" }, signal));
    if (result?.passos) setGaps(result.passos);
  };
  const asked = useRef(false);
  // Opened from the page (a controlled dialog): the first opening asks.
  useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    void ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>O que está faltando?</DialogTitle>
          <DialogDescription>A IA lê o briefing, o orçamento e os passos e sugere o que esta jornada pode precisar. Acrescente só o que fizer sentido.</DialogDescription>
        </DialogHeader>
        {pending ? (
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Lendo a jornada…
          </p>
        ) : gaps && gaps.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {gaps.map((gap) => {
              const done = added.includes(gap.titulo);
              return (
                <li key={gap.titulo} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-sm font-medium text-foreground">{gap.titulo}</p>
                    <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                      {stageTitle(gap.etapa)} · {gap.motivo}
                    </p>
                  </div>
                  <ServerForm action={addJourneyStep} onSuccess={() => setAdded((list) => [...list, gap.titulo])} className="shrink-0">
                    <input type="hidden" name="journeyId" value={journeyId} />
                    <input type="hidden" name="title" value={gap.titulo} />
                    <input type="hidden" name="stage" value={gap.etapa} />
                    <input type="hidden" name="note" value={gap.motivo} />
                    <SubmitButton size="sm" variant="outline" disabled={done} pendingLabel="Acrescentando…">
                      {done ? "Acrescentado" : (
                        <>
                          <PlusIcon />
                          Acrescentar
                        </>
                      )}
                    </SubmitButton>
                  </ServerForm>
                </li>
              );
            })}
          </ul>
        ) : gaps ? (
          <p className="m-0 text-sm text-muted-foreground">Nada a acrescentar por enquanto.</p>
        ) : null}
        {!pending && (
          <Button type="button" variant={gaps ? "ghost" : "outline"} size="sm" className="self-start" onClick={ask}>
            {gaps ? <RefreshCwIcon /> : <SparklesIcon />}
            {gaps ? "Perguntar de novo" : "Perguntar à IA"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
