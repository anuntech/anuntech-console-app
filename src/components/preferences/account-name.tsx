"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { updateAccountName } from "@/lib/account-actions";
import type { ActionState } from "@/lib/action-state";
import { toast } from "@/components/notifications";
import { Field, focusFirstInvalid } from "@/components/field";
import styles from "./account-fields.module.css";

type NameState = ActionState & { submitted?: string };

export function AccountName({ name }: { name: string }) {
  const [value, setValue] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const [state, action, pending] = useActionState<NameState, FormData>(
    async (previous, form) => ({
      ...(await updateAccountName(previous, form)),
      submitted: String(form.get("name") || ""),
    }),
    {},
  );
  const saved = state.success ? state.submitted!.trim() : name;
  const changed = value.trim() !== saved;
  const visibleError = state.submitted === value ? state.error : undefined;
  useEffect(() => {
    if (state.error) error.current?.focus();
    else if (state.success) {
      toast.success(state.success);
      input.current?.focus();
    }
  }, [state]);

  return (
    <form
      onInvalidCapture={(event) => focusFirstInvalid(event.currentTarget)}
      action={action}
      className={styles.fieldRow}
      aria-label="Nome"
      aria-busy={pending}
    >
      <Field label="Nome">
        <input
          ref={input}
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          value={value}
          readOnly={pending}
          aria-invalid={!!visibleError || undefined}
          aria-describedby={visibleError ? id : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      {visibleError && (
        <p
          ref={error}
          id={id}
          tabIndex={-1}
          role="alert"
          className="form-error"
        >
          {visibleError}
        </p>
      )}
      {(changed || pending) && (
        <div className={styles.actions}>
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={() => {
              setValue(saved);
              input.current?.focus();
            }}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={pending}>
            {pending ? "Salvando…" : "Salvar nome"}
          </button>
        </div>
      )}
      <p role="status" className="sr-only">
        {pending ? "Salvando nome…" : ""}
      </p>
    </form>
  );
}
