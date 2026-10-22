"use client";
import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { Loader2Icon, MicIcon, SquareIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { clockLabel, joinTranscript, PRIVACY_LINE } from "@/lib/voice/voice-rules";
import { caretOf, mayFocus, rangeFor, setNativeValue, type Caret } from "./insert-text";
import { useDictation } from "./use-dictation";

/**
 * "Falar" under a textarea: records, transcribes and puts the text where the
 * person was typing, for them to review. The textarea stays uncontrolled, so
 * the form's own reset keeps working. Sending the form ends a recording; while
 * the text is still coming back, the form waits.
 */
export function DictationButton({ target, maxLength }: { target: RefObject<HTMLTextAreaElement | null>; maxLength: number }) {
  const controls = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLButtonElement>(null);
  // Caught on pointerdown, before the tap takes the focus away from the field.
  const tapped = useRef<Caret>(null);
  const caret = useRef<Caret>(null);
  const dictation = useDictation((text) => {
    const el = target.current;
    if (!el) return;
    const [start, end] = rangeFor(el, caret.current);
    const result = joinTranscript(el.value, start, end, text, maxLength);
    setNativeValue(el, result.value);
    if (mayFocus(el, controls.current)) {
      el.focus({ preventScroll: true });
      el.setSelectionRange(result.caret, result.caret);
    }
    if (result.truncated)
      return `O texto passou do limite de ${maxLength.toLocaleString("pt-BR")} caracteres e foi cortado. Revise antes de enviar.`;
  });
  const { busy, phase, cancel, say } = dictation;

  useEffect(() => {
    const form = target.current?.form;
    if (!form || !busy) return;
    const onSubmit = (event: SubmitEvent) => {
      if (phase === "transcribing") {
        // What was said is still on its way: sending now would leave it out.
        event.preventDefault();
        say("Aguarde a transcrição terminar ou toque em Cancelar gravação.");
      } else cancel();
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [target, busy, phase, cancel, say]);

  if (!dictation.supported) return null;
  const recording = phase === "recording";
  const waiting = busy && !recording;
  return (
    <div ref={controls} data-assistant-ignore className="mt-2 flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <span role="status" aria-live="polite" className="sr-only">
        {dictation.notice}
      </span>
      <p
        aria-hidden="true"
        className={cn("m-0 mr-auto min-w-0 flex-1 basis-40 text-xs text-muted-foreground", phase === "error" && "text-destructive")}
      >
        {recording ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5 text-foreground">
            <span
              className="size-2 rounded-full bg-destructive motion-safe:animate-pulse motion-safe:[transform:scale(var(--level))]"
              style={{ "--level": 1 + dictation.level * 0.8 } as CSSProperties}
            />
            Gravando <span className="tabular-nums">{clockLabel(dictation.seconds)}</span>
            {dictation.ending && <span className="text-destructive">· Faltam 10 segundos</span>}
          </span>
        ) : (
          dictation.notice
        )}
        {busy && <span className="mt-0.5 block">{PRIVACY_LINE}</span>}
      </p>
      {busy && (
        <Button type="button" variant="ghost" size="sm" onClick={cancel}>
          Cancelar gravação
        </Button>
      )}
      {dictation.canRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            dictation.retry();
            main.current?.focus();
          }}
        >
          Tentar de novo
        </Button>
      )}
      <Button
        ref={main}
        type="button"
        variant="outline"
        size="sm"
        // Not `disabled`: a disabled button drops the focus.
        aria-disabled={waiting || undefined}
        className={cn(waiting && "cursor-wait opacity-70")}
        onPointerDown={() => {
          if (!busy) tapped.current = caretOf(target.current);
        }}
        onClick={() => {
          if (recording) return dictation.stop();
          if (busy) return;
          caret.current = tapped.current ?? caretOf(target.current);
          tapped.current = null;
          dictation.start();
        }}
      >
        {recording ? (
          <>
            <SquareIcon className="fill-current" />
            Parar
          </>
        ) : waiting ? (
          <>
            <Loader2Icon className="motion-safe:animate-spin" />
            {phase === "starting" ? "Abrindo o microfone…" : "Transcrevendo…"}
          </>
        ) : (
          <>
            <MicIcon />
            Falar
          </>
        )}
      </Button>
    </div>
  );
}
