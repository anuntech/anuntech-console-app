"use client";
import { useRef, useState } from "react";
import { Loader2Icon, SparklesIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormSection } from "@/components/console/form-field";
import { DictationButton } from "@/components/console/dictation-button";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { toast } from "@/components/shell/notifications";
import { saveJourneyBriefing } from "@/lib/journeys/journey-actions";
import { emptyBriefing, PROJECT_TYPES, projectTypeLabels, type JourneyBriefing } from "@/lib/journeys/journey-model";
import { askJourneyAi, useAiCall } from "./journey-ai";

type ListKey = "funcionalidades" | "integracoes" | "restricoes" | "perguntasAbertas" | "riscos" | "proximosPassos";
const lists: { key: ListKey; label: string; hint?: string; limit: number }[] = [
  { key: "funcionalidades", label: "Funcionalidades", hint: "Uma por linha.", limit: 30 },
  { key: "integracoes", label: "Integrações", limit: 15 },
  { key: "restricoes", label: "Restrições", limit: 15 },
  { key: "perguntasAbertas", label: "Perguntas em aberto", hint: "Uma por linha: o que ainda precisa da resposta do cliente.", limit: 20 },
  { key: "riscos", label: "Riscos", limit: 15 },
  { key: "proximosPassos", label: "Próximos passos", limit: 10 },
];
const toLines = (items: string[]) => items.join("\n");
const fromLines = (text: string, limit: number) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, limit);

/**
 * The first meeting, written down: notes (typed, dictated or a pasted
 * transcript) and, from them, the structured briefing. "Organizar com IA"
 * only fills the form; the team reads, fixes and saves.
 */
export function JourneyBriefingEditor({ journeyId, briefing, voice }: { journeyId: string; briefing: JourneyBriefing | null; voice: boolean }) {
  const initial = briefing ?? emptyBriefing();
  const [value, setValue] = useState<JourneyBriefing>(initial);
  const [lines, setLines] = useState<Record<ListKey, string>>(() =>
    Object.fromEntries(lists.map((list) => [list.key, toLines(initial[list.key])])) as Record<ListKey, string>,
  );
  const [transcript, setTranscript] = useState("");
  const notes = useRef<HTMLTextAreaElement>(null);
  const { pending, run, cancel } = useAiCall();
  const set = <K extends keyof JourneyBriefing>(key: K, next: JourneyBriefing[K]) => setValue((current) => ({ ...current, [key]: next }));
  const organize = async () => {
    const notas = notes.current?.value.trim() ?? "";
    if (!notas && !transcript.trim()) {
      toast.error("Escreva, dite ou cole as notas da reunião antes.");
      return;
    }
    const result = await run((signal) =>
      askJourneyAi(journeyId, { tipo: "briefing", notas: notas || transcript.trim().slice(0, 16000), transcricao: notas && transcript.trim() ? transcript.trim() : undefined }, signal),
    );
    if (!result?.briefing) return;
    const next = { ...result.briefing, notas: notes.current?.value ?? value.notas };
    setValue(next);
    setLines(Object.fromEntries(lists.map((list) => [list.key, toLines(next[list.key])])) as Record<ListKey, string>);
    toast.success("Briefing organizado. Confira antes de salvar.");
  };
  const payload = (): string =>
    JSON.stringify({
      ...value,
      notas: notes.current?.value ?? value.notas,
      ...Object.fromEntries(lists.map((list) => [list.key, fromLines(lines[list.key], list.limit)])),
    });
  return (
    <ServerForm
      action={saveJourneyBriefing}
      prepare={async (form) => {
        form.set("briefing", payload());
        return form;
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="id" value={journeyId} />
      <FormError />
      <FormSection title="Notas da reunião">
        <FormField label="O que foi dito" htmlFor="briefing-notas" hint="Escreva do seu jeito ou dite. A IA organiza nos campos abaixo.">
          <Textarea
            ref={notes}
            id="briefing-notas"
            defaultValue={initial.notas}
            onChange={(event) => set("notas", event.target.value)}
            rows={6}
            maxLength={16000}
            placeholder="Ex.: Cliente quer um app para os vendedores registrarem visitas, com fotos e GPS…"
          />
          {voice && <DictationButton target={notes} maxLength={16000} />}
        </FormField>
        <details className="rounded-lg border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Colar a transcrição da reunião</summary>
          <Textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={6}
            maxLength={16000}
            className="mt-2"
            aria-label="Transcrição da reunião"
            placeholder="Cole aqui a transcrição gerada pela ferramenta da reunião. Ela não fica guardada: só as notas e o briefing."
          />
        </details>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={organize} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {pending ? "Organizando…" : "Organizar com IA"}
          </Button>
          {pending && (
            <Button type="button" variant="ghost" size="sm" onClick={cancel}>
              <SquareIcon />
              Parar
            </Button>
          )}
          <span className="text-xs text-muted-foreground">Nada é inventado: o que não foi dito vira pergunta em aberto.</span>
        </div>
      </FormSection>
      <FormSection title="Briefing">
        <FormField label="Objetivo" htmlFor="briefing-objetivo">
          <Textarea id="briefing-objetivo" value={value.objetivo} onChange={(event) => set("objetivo", event.target.value)} rows={2} maxLength={600} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Problema que resolve" htmlFor="briefing-problema">
            <Textarea id="briefing-problema" value={value.problema} onChange={(event) => set("problema", event.target.value)} rows={2} maxLength={600} />
          </FormField>
          <FormField label="Quem vai usar" htmlFor="briefing-publico">
            <Textarea id="briefing-publico" value={value.publico} onChange={(event) => set("publico", event.target.value)} rows={2} maxLength={400} />
          </FormField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Tipo de projeto" htmlFor="briefing-tipo">
            <NativeSelect
              id="briefing-tipo"
              value={value.tipoProjeto ?? ""}
              onChange={(event) => set("tipoProjeto", (event.target.value || null) as JourneyBriefing["tipoProjeto"])}
            >
              <NativeSelectOption value="">Ainda não sei</NativeSelectOption>
              {PROJECT_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {projectTypeLabels[type]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Quem decide" htmlFor="briefing-decisor">
            <Input id="briefing-decisor" value={value.decisor} onChange={(event) => set("decisor", event.target.value)} maxLength={200} />
          </FormField>
          <FormField label="Prazo desejado" htmlFor="briefing-prazo">
            <Input id="briefing-prazo" value={value.prazoDesejado} onChange={(event) => set("prazoDesejado", event.target.value)} maxLength={200} />
          </FormField>
          <FormField label="Verba do cliente" htmlFor="briefing-verba">
            <Input id="briefing-verba" value={value.orcamentoCliente} onChange={(event) => set("orcamentoCliente", event.target.value)} maxLength={200} />
          </FormField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {lists.map((list) => (
            <FormField
              key={list.key}
              label={list.label}
              htmlFor={`briefing-${list.key}`}
              hint={
                fromLines(lines[list.key], Infinity).length > list.limit
                  ? `Até ${list.limit} itens: os que passarem não são salvos.`
                  : (list.hint ?? "Um por linha.")
              }
            >
              <Textarea
                id={`briefing-${list.key}`}
                value={lines[list.key]}
                onChange={(event) => setLines((current) => ({ ...current, [list.key]: event.target.value }))}
                rows={list.key === "funcionalidades" ? 6 : 3}
              />
            </FormField>
          ))}
        </div>
      </FormSection>
      <SubmitButton className="self-start" pendingLabel="Salvando…">
        Salvar briefing
      </SubmitButton>
    </ServerForm>
  );
}
