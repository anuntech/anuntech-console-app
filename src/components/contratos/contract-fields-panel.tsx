"use client";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFormStatus } from "react-dom";
import { ListChecksIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setNativeValue } from "@/components/console/insert-text";
import { applyContractFields, contractFields, fieldRange, removeContractField } from "@/lib/contracts/contract-fields";

export type FieldSuggestions = Record<string, { value: string; source: string }>;

/**
 * "Campos do contrato": every {{placeholder}} still in the draft, filled at
 * the top of the page. The values go into the text below (applied, or on any
 * save of the draft), so the text stays the one source of the contract; the
 * inputs themselves are never submitted.
 */
export function ContractFieldsPanel({
  bodyRef,
  initialBody,
  suggestions,
}: {
  bodyRef: RefObject<HTMLTextAreaElement | null>;
  initialBody: string;
  suggestions: FieldSuggestions;
}) {
  // Rendered inside the draft's form: nothing here acts while a save is on its way.
  const { pending } = useFormStatus();
  const [body, setBody] = useState(initialBody);
  const [values, setValues] = useState<Record<string, string>>({});
  const valuesRef = useRef(values);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fields = useMemo(() => contractFields(body), [body]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    const el = bodyRef.current;
    const form = el?.form;
    if (!el || !form) return;
    // The text can change by hand too: the list follows it.
    const sync = () => setBody(el.value);
    // A failed save resets the form to the saved text after the event: read it once the reset ran.
    const onReset = () => window.setTimeout(sync);
    // "Salvar rascunho" takes what was typed here too. Window capture runs before React reads the form data.
    const onSubmit = (event: SubmitEvent) => {
      if (event.target !== form) return;
      const result = applyContractFields(el.value, valuesRef.current);
      if (result.applied) setNativeValue(el, result.body);
    };
    el.addEventListener("input", sync);
    form.addEventListener("reset", onReset);
    window.addEventListener("submit", onSubmit, true);
    return () => {
      el.removeEventListener("input", sync);
      form.removeEventListener("reset", onReset);
      window.removeEventListener("submit", onSubmit, true);
    };
  }, [bodyRef]);

  const filled = fields.filter((field) => values[field.key]?.trim()).length;
  const write = (next: string) => {
    const el = bodyRef.current;
    if (!el) return;
    setNativeValue(el, next);
    setBody(next);
  };
  const apply = (save: boolean) => {
    const el = bodyRef.current;
    if (!el) return;
    const result = applyContractFields(el.value, values);
    if (!result.applied) return;
    // The values stay: if a save fails and the text comes back, so do they.
    write(result.body);
    setUndo(null);
    const done = `${result.applied === 1 ? "1 campo aplicado" : `${result.applied} campos aplicados`} ao texto.`;
    if (save && el.form?.checkValidity()) {
      setNotice(`${done} Salvando o rascunho…`);
      el.form.requestSubmit();
    } else {
      setNotice(`${done} Salve o rascunho para guardar.`);
      if (save) el.form?.reportValidity();
    }
    headingRef.current?.focus();
  };
  const show = (key: string) => {
    const el = bodyRef.current;
    const range = el && fieldRange(el.value, key);
    if (!el || !range) return;
    // Focus would scroll to the old caret: the selection is set while the field is out of focus.
    el.blur();
    el.setSelectionRange(range[0], range[1]);
    el.focus();
  };
  const remove = (key: string, label: string, index: number) => {
    const el = bodyRef.current;
    if (!el) return;
    setUndo(el.value);
    write(removeContractField(el.value, key));
    setNotice(`Campo "${label}" removido do texto. Salve o rascunho para guardar.`);
    // The next field takes the focus, or the panel's title when it was the last.
    window.setTimeout(() => {
      const next = fields[index + 1] ?? fields[index - 1];
      const target = next && next.key !== key ? document.getElementById(`contract-field-${next.key}`) : null;
      (target ?? headingRef.current)?.focus();
    });
  };

  const status = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p role="status" aria-live="polite" className="m-0 min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
        {notice ||
          (filled ? `${filled === 1 ? "1 campo preenchido" : `${filled} campos preenchidos`}, ainda fora do texto. Salvar o rascunho também aplica.` : "")}
      </p>
      {undo !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            write(undo);
            setUndo(null);
            setNotice("Remoção desfeita.");
          }}
        >
          Desfazer
        </Button>
      )}
    </div>
  );

  if (!fields.length)
    return notice || undo !== null ? (
      <section aria-labelledby="contract-fields-title" className="rounded-xl border bg-secondary/40 p-4">
        <h3 id="contract-fields-title" ref={headingRef} tabIndex={-1} className="m-0 mb-1 text-sm font-semibold text-foreground outline-none">
          Campos do contrato
        </h3>
        <p className="m-0 mb-2 text-xs text-muted-foreground">Nenhum campo sem valor no texto.</p>
        {status}
      </section>
    ) : null;

  return (
    <section aria-labelledby="contract-fields-title" className="rounded-xl border border-warning-edge bg-warning-soft/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-1">
        <ListChecksIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <h3 id="contract-fields-title" ref={headingRef} tabIndex={-1} className="m-0 text-sm font-semibold text-foreground outline-none">
            Campos do contrato
          </h3>
          <p className="m-0 mt-0.5 text-xs text-muted-foreground">
            {fields.length === 1 ? "1 campo sem valor" : `${fields.length} campos sem valor`} no texto. Preencha aqui e aplique: o valor
            entra no lugar do campo em todo o texto. O que não se aplica a este contrato pode ser removido. O contrato só vai para
            assinatura sem nenhum campo aberto.
          </p>
        </div>
      </div>
      <div className="grid gap-x-5 gap-y-5 lg:grid-cols-2">
        {fields.map((field, index) => {
          const id = `contract-field-${field.key}`;
          const hint = `${id}-hint`;
          const suggestion = suggestions[field.key];
          const value = values[field.key] ?? "";
          const set = (next: string) => {
            setValues((current) => ({ ...current, [field.key]: next }));
            setNotice("");
          };
          return (
            <div key={field.key} className={field.long ? "min-w-0 lg:col-span-2" : "min-w-0"}>
              <div className="mb-1 flex items-start gap-2">
                <Label htmlFor={id} className="min-w-0 flex-1 leading-snug">
                  {field.label}
                </Label>
                {field.count > 1 && <span className="shrink-0 text-xs text-muted-foreground">aparece {field.count} vezes</span>}
              </div>
              <p id={hint} className="m-0 mb-1.5 line-clamp-2 text-xs text-muted-foreground">
                {field.before}
                <mark className="rounded bg-warning/15 px-0.5 text-warning">{`{{${field.key}}}`}</mark>
                {field.after}
              </p>
              {field.long ? (
                <Textarea
                  id={id}
                  rows={3}
                  value={value}
                  aria-describedby={hint}
                  onChange={(event) => set(event.target.value)}
                  className="min-h-20 bg-card"
                />
              ) : (
                <Input
                  id={id}
                  value={value}
                  aria-describedby={hint}
                  onChange={(event) => set(event.target.value)}
                  // Enter here must not submit the whole contract.
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  className="bg-card"
                />
              )}
              {suggestion && value !== suggestion.value && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    set(suggestion.value);
                    document.getElementById(id)?.focus();
                  }}
                  className="mt-1.5 flex w-full min-w-0 items-start gap-1.5 rounded-md border border-dashed bg-card px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-60"
                >
                  <SparklesIcon aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block break-words font-medium text-foreground">Usar {suggestion.value}</span>
                    <span className="block text-muted-foreground">{suggestion.source}</span>
                  </span>
                </button>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-5">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  aria-label={`Ver ${field.label} no texto`}
                  className="h-auto px-0 py-1.5 text-xs text-muted-foreground"
                  onClick={() => show(field.key)}
                >
                  Ver no texto
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  disabled={pending}
                  aria-label={`Remover ${field.label} do texto`}
                  className="h-auto px-0 py-1.5 text-xs text-muted-foreground"
                  onClick={() => remove(field.key, field.label, index)}
                >
                  Remover do texto
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-warning-edge/60 pt-4">
        <div className="mr-auto min-w-0 flex-1 basis-48">{status}</div>
        <Button type="button" variant="outline" size="sm" disabled={pending || !filled} onClick={() => apply(false)}>
          Aplicar ao texto
        </Button>
        <Button type="button" size="sm" disabled={pending || !filled} onClick={() => apply(true)}>
          {pending ? "Salvando…" : "Aplicar e salvar"}
        </Button>
      </div>
    </section>
  );
}
