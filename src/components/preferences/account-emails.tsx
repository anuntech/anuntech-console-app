"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Mail, Plus } from "lucide-react";
import {
  requestAccountEmail,
  confirmAccountEmail,
  removeAccountEmail,
} from "@/lib/account-actions";
import { ActionForm } from "@/components/action-form";
import { Field, focusFirstInvalid } from "@/components/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
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
        <p className={fields.feedback} role="status">
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

function EmailFlow({
  sourceEmail,
  initialEmail,
  primary,
  complete,
  busy,
}: {
  sourceEmail: string;
  initialEmail?: string;
  primary: boolean;
  complete: () => void;
  busy: (pending: boolean) => void;
}) {
  const [state, action, pending] = useActionState(requestAccountEmail, {});
  const errorRef = useRef<HTMLParagraphElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    busy(pending);
  }, [pending, busy]);
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
    if (state.challengeId) codeRef.current?.focus();
  }, [state]);
  if (state.challengeId)
    return (
      <ActionForm
        action={confirmAccountEmail}
        label="Confirmar e-mail"
        onPendingChange={busy}
        onSuccess={complete}
        cancel={<DialogClose className="button">Cancelar</DialogClose>}
      >
        <input type="hidden" name="challengeId" value={state.challengeId} />
        <p className="muted">
          Enviamos um código para cada endereço. Eles valem por 5 minutos.
        </p>
        <Field label={`Código enviado para ${sourceEmail}`}>
          <input
            ref={codeRef}
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
        {state.primary && (
          <p className="muted">
            Após confirmar, você entrará novamente usando o novo e-mail
            principal.
          </p>
        )}
      </ActionForm>
    );
  return (
    <form
      action={action}
      className="form"
      aria-busy={pending}
      onInvalidCapture={(event) => focusFirstInvalid(event.currentTarget)}
    >
      <input type="hidden" name="primary" value={String(primary)} />
      <Field
        label={primary ? "Novo e-mail principal" : "E-mail adicional"}
        hint="Confirme este endereço e seu e-mail principal atual para proteger a conta."
      >
        <input
          type="email"
          name="email"
          autoComplete="email"
          maxLength={254}
          defaultValue={initialEmail}
          readOnly={!!initialEmail}
          required
          disabled={pending}
        />
      </Field>
      {state.error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <div className={styles.actions}>
        <DialogClose className="button" disabled={pending}>
          Cancelar
        </DialogClose>
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? "Enviando códigos…" : "Enviar códigos"}
        </button>
      </div>
    </form>
  );
}

function EmailDialog({
  sourceEmail,
  initialEmail,
  primary = false,
  label,
  disabled,
}: {
  sourceEmail: string;
  initialEmail?: string;
  primary?: boolean;
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(value, details) => {
        if (pending && !value) {
          details.cancel();
          return;
        }
        setOpen(value);
      }}
    >
      <DialogTrigger ref={trigger} className="button" disabled={disabled}>
        {!primary && <Plus size={16} aria-hidden="true" />}
        {label}
      </DialogTrigger>
      <DialogContent busy={pending} finalFocus={trigger}>
        <div className={modal.header}>
          <DialogTitle className={modal.title}>
            {primary ? "Alterar e-mail principal" : "Adicionar e-mail"}
          </DialogTitle>
          <DialogDescription className={modal.description}>
            {primary
              ? "O endereço anterior continuará na conta para preservar seus vínculos."
              : "Guarde seus contatos verificados no mesmo perfil. O acesso continua pelo e-mail principal."}
          </DialogDescription>
        </div>
        {open && (
          <EmailFlow
            sourceEmail={sourceEmail}
            initialEmail={initialEmail}
            primary={primary}
            complete={() => {
              setPending(false);
              setOpen(false);
            }}
            busy={setPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AccountEmails({
  primaryEmail,
  emails,
  securityEnabled,
}: {
  primaryEmail: string;
  emails: { id: string; email: string; protected: boolean }[];
  securityEnabled: boolean;
}) {
  return (
    <div className={styles.contacts}>
      <PrimaryEmail email={primaryEmail} disabled={securityEnabled} />
      <ul className={styles.list}>
        {emails
          .filter((entry) => entry.email !== primaryEmail)
          .map((entry) => (
            <li className={styles.row} key={entry.id}>
              <Mail size={18} aria-hidden="true" />
              <div className={styles.address}>
                <strong>{entry.email}</strong>
                <span>E-mail verificado</span>
              </div>
              <div className={styles.rowActions}>
                <EmailDialog
                  sourceEmail={primaryEmail}
                  initialEmail={entry.email}
                  primary
                  label="Tornar principal"
                  disabled={securityEnabled}
                />
                {!entry.protected && !securityEnabled && (
                  <ActionForm
                    action={removeAccountEmail}
                    label="Remover"
                    submitAriaLabel={`Remover e-mail ${entry.email}`}
                    className={styles.remove}
                    danger
                    confirm={{
                      title: "Remover e-mail?",
                      description: `${entry.email} será removido dos contatos desta conta.`,
                      confirmLabel: "Remover e-mail",
                    }}
                  >
                    <input type="hidden" name="id" value={entry.id} />
                  </ActionForm>
                )}
              </div>
            </li>
          ))}
      </ul>
      <div className={styles.footer}>
        <EmailDialog
          sourceEmail={primaryEmail}
          label="Adicionar e-mail"
          disabled={securityEnabled || emails.length >= 5}
        />
        {securityEnabled && (
          <p>
            Desative a verificação em duas etapas para alterar os contatos de
            acesso.
          </p>
        )}
      </div>
    </div>
  );
}
