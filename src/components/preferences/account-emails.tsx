"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  requestAccountEmail,
  confirmAccountEmail,
} from "@/lib/account-actions";
import { ActionForm } from "@/components/action-form";
import { Field, focusFirstInvalid } from "@/components/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import modal from "@/components/ui/modal.module.css";
import styles from "./account-emails.module.css";
import fields from "./account-fields.module.css";

function PrimaryEmail({
  email,
  disabled,
}: {
  email: string;
  disabled: boolean;
}) {
  const [value, setValue] = useState(email);
  const [state, action, pending] = useActionState(requestAccountEmail, {});
  const [dismissed, setDismissed] = useState<string>();
  const [hiddenError, setHiddenError] = useState(state);
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const code = useRef<HTMLInputElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const changed = value.trim().toLowerCase() !== email;
  const error = hiddenError !== state ? state.error : undefined;
  const open = !!state.challengeId && state.challengeId !== dismissed;
  useEffect(() => {
    if (state.error) alert.current?.focus();
  }, [state]);
  return (
    <>
      <form
        onInvalidCapture={(event) => focusFirstInvalid(event.currentTarget)}
        action={action}
        className={fields.fieldRow}
        aria-label="E-mail principal"
        aria-busy={pending}
        onSubmit={(event) => {
          if (!changed || disabled || pending) event.preventDefault();
        }}
      >
        <input type="hidden" name="primary" value="true" />
        <Field label="E-mail" hint="E-mail principal de acesso.">
          <input
            ref={input}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={value}
            disabled={disabled}
            readOnly={pending}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? id : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setHiddenError(state);
            }}
          />
        </Field>
        {error && (
          <p
            ref={alert}
            id={id}
            tabIndex={-1}
            role="alert"
            className="form-error"
          >
            {error}
          </p>
        )}
        {(changed || pending) && !disabled && (
          <div className={fields.actions}>
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() => {
                setValue(email);
                setHiddenError(state);
                input.current?.focus();
              }}
            >
              Cancelar
            </button>
            <button className="button primary" disabled={pending}>
              {pending ? "Enviando códigos…" : "Salvar e-mail"}
            </button>
          </div>
        )}
        <p className="sr-only" role="status">
          {pending
            ? "Enviando os códigos de confirmação para os dois endereços…"
            : ""}
        </p>
      </form>
      <Dialog
        open={open}
        disablePointerDismissal
        onOpenChange={(next, details) => {
          if (!next && confirming) details.cancel();
          else if (!next) setDismissed(state.challengeId);
        }}
      >
        <DialogContent busy={confirming} initialFocus={code} finalFocus={input}>
          <div className={modal.header}>
            <DialogTitle className={modal.title}>
              Confirmar novo e-mail
            </DialogTitle>
            <DialogDescription className={modal.description}>
              Confirme os códigos enviados aos dois endereços. Após salvar,
              entre novamente com o novo e-mail.
            </DialogDescription>
          </div>
          {open && (
            <ActionForm
              key={state.challengeId}
              action={confirmAccountEmail}
              label="Confirmar e-mail"
              onPendingChange={setConfirming}
              onSuccess={() => {
                setConfirming(false);
                setDismissed(state.challengeId);
              }}
              cancel={
                <DialogClose className="button" disabled={confirming}>
                  Cancelar
                </DialogClose>
              }
            >
              <input
                type="hidden"
                name="challengeId"
                value={state.challengeId}
              />
              <Field
                label={`Código enviado para ${email}`}
                hint="Válido por 5 minutos."
              >
                <input
                  ref={code}
                  name="sourceCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </Field>
              <Field label={`Código enviado para ${state.email}`}>
                <input
                  name="targetCode"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </Field>
            </ActionForm>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AccountEmails({ primaryEmail, securityEnabled }: {
  primaryEmail: string;
  securityEnabled: boolean;
}) {
  return (
    <div className={styles.contacts}>
      <PrimaryEmail email={primaryEmail} disabled={securityEnabled} />
      {securityEnabled && <p className={styles.footer}>Desative a verificação em duas etapas para trocar o e-mail.</p>}
    </div>
  );
}
