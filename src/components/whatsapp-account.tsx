"use client";
import { toast } from "./notifications";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Field, focusFirstInvalid } from "./field";
import { normalizePhone, useCooldown } from "./otp-login";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import modal from "./ui/modal.module.css";
import styles from "./preferences/account-fields.module.css";

export function WhatsappAccount({
  phone,
  securityEnabled = false,
}: {
  phone: string | null;
  securityEnabled?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const numberInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const [saved, setSaved] = useState(phone || "");
  const [number, setNumber] = useState(phone || "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<"number" | "code" | null>(
    null,
  );
  const [seconds, startCooldown] = useCooldown();
  const normalized = number.trim() ? normalizePhone(number) : "";
  const changed = normalized !== saved;

  function clearFeedback() {
    setError("");
    setInvalidField(null);
    setMessage("");
  }
  function cancel() {
    setNumber(saved);
    setCode("");
    setSent(false);
    clearFeedback();
    numberInput.current?.focus();
  }
  function fail(message: string, field?: "number" | "code") {
    setError(message);
    setInvalidField(field || null);
    requestAnimationFrame(() => {
      if (field) (field === "code" ? codeInput : numberInput).current?.focus();
      else errorRef.current?.focus();
    });
  }
  async function act(action: "send" | "verify" | "remove") {
    if (securityEnabled || lock.current) return false;
    if (action === "send" && seconds > 0) {
      fail("Aguarde um minuto entre os envios de código.");
      return false;
    }
    if (action !== "remove" && (!changed || !normalized)) return false;
    if (action !== "remove" && !/^\+[1-9]\d{9,14}$/.test(normalized)) {
      fail(
        "Informe um telefone válido com DDD. Para outro país, use + e o DDI.",
        "number",
      );
      return false;
    }
    lock.current = true;
    setBusy(true);
    clearFeedback();
    try {
      const result =
        action === "send"
          ? await authClient.phoneNumber.sendOtp(
              { phoneNumber: normalized },
              { headers: { "x-console-purpose": "bind" } },
            )
          : action === "verify"
            ? await authClient.phoneNumber.verify({
                phoneNumber: normalized,
                code,
                updatePhoneNumber: true,
                disableSession: true,
              })
            : await authClient.updateUser({ phoneNumber: null });
      if (result.error) {
        const errorCode = result.error.code;
        if (result.error.status === 401)
          fail(
            "Entre novamente para alterar seu telefone. Confirme a alteração nos primeiros 10 minutos após entrar.",
          );
        else if (result.error.status === 429)
          fail("Aguarde antes de pedir outro código.");
        else if (errorCode === "PHONE_NUMBER_EXIST") {
          setSent(false);
          setCode("");
          fail(
            "Este telefone já está vinculado a uma conta. Informe outro número e solicite um novo código.",
            "number",
          );
        } else if (result.error.status >= 500)
          fail(
            "O envio ou a confirmação está indisponível. Aguarde e tente novamente.",
          );
        else if (action === "verify")
          fail(
            "Código inválido ou expirado. Confira o código ou solicite outro.",
            "code",
          );
        else
          fail(
            "Não foi possível alterar o telefone. Confira o número e tente novamente.",
            "number",
          );
        return false;
      }
      if (action === "send") {
        setSent(true);
        setCode("");
        startCooldown();
        setMessage("Código enviado pelo WhatsApp. Ele vale por 5 minutos.");
        requestAnimationFrame(() => codeInput.current?.focus());
      } else {
        const next = action === "remove" ? "" : normalized;
        setSaved(next);
        setNumber(next);
        setSent(false);
        setCode("");
        toast.success(
          action === "remove"
            ? "Telefone removido."
            : "Telefone confirmado e atualizado.",
        );
        numberInput.current?.focus();
        router.refresh();
      }
      return true;
    } catch {
      fail("Não foi possível conectar. Tente novamente.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <form
        onInvalidCapture={(event) => focusFirstInvalid(event.currentTarget)}
        className={`${styles.fieldRow} ${styles.divider}`}
        aria-label="Telefone"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (!changed || securityEnabled || busy) return;
          if (!normalized && saved) {
            clearFeedback();
            setConfirmOpen(true);
          } else void act(sent ? "verify" : "send");
        }}
      >
        <Field
          label="Telefone"
          hint={
            securityEnabled
              ? "Desative a verificação em duas etapas antes de alterar seu telefone."
              : changed
                ? "Confirme o novo número com um código enviado pelo WhatsApp."
                : undefined
          }
        >
          <input
            ref={numberInput}
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={25}
            value={number}
            placeholder="(11) 99999-9999"
            readOnly={sent || busy}
            disabled={securityEnabled}
            aria-invalid={invalidField === "number" || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => {
              setNumber(event.target.value);
              clearFeedback();
            }}
          />
        </Field>
        {sent && (
          <Field
            label="Código de confirmação"
            hint="Digite os 6 números recebidos. Válido por 5 minutos."
          >
            <input
              ref={codeInput}
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              readOnly={busy}
              aria-invalid={invalidField === "code" || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ""));
                clearFeedback();
              }}
            />
          </Field>
        )}
        {error && !confirmOpen && (
          <p
            ref={errorRef}
            id={`${id}-error`}
            className="form-error"
            role="alert"
            tabIndex={-1}
          >
            {error}
          </p>
        )}
        {changed && !securityEnabled && (
          <div className={styles.actions}>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={cancel}
            >
              Cancelar
            </button>
            {sent && (
              <button
                type="button"
                className="button"
                disabled={busy || seconds > 0}
                aria-label={
                  seconds
                    ? "Reenviar código. Aguarde um minuto entre envios."
                    : "Reenviar código"
                }
                onClick={() => void act("send")}
              >
                <span aria-hidden={seconds > 0 || undefined}>
                  {seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
                </span>
              </button>
            )}
            <button
              className="button primary"
              disabled={busy || (!sent && seconds > 0 && !!normalized)}
            >
              {busy
                ? "Aguarde…"
                : sent
                  ? "Confirmar telefone"
                  : !normalized
                    ? "Remover telefone"
                    : seconds > 0
                      ? `Aguarde ${seconds}s`
                      : "Salvar telefone"}
            </button>
          </div>
        )}
        <p role="status" aria-atomic="true" className={styles.feedback}>
          {busy && !confirmOpen
            ? "Processando a alteração do telefone…"
            : !sent && changed && normalized && seconds > 0
              ? "Aguarde um minuto entre os envios de código antes de salvar outro telefone."
              : message}
        </p>
      </form>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open, details) => {
          if (busy) details.cancel();
          else setConfirmOpen(open);
        }}
      >
        <AlertDialogContent initialFocus={cancelRef} finalFocus={numberInput}>
          <div className={modal.header}>
            <AlertDialogTitle className={modal.title}>
              Remover telefone?
            </AlertDialogTitle>
            <AlertDialogDescription className={modal.description}>
              O número {saved} deixará de ser usado para entrar. Você poderá
              continuar acessando por e-mail ou Google.
            </AlertDialogDescription>
          </div>
          {error && (
            <p ref={errorRef} className="form-error" role="alert" tabIndex={-1}>
              {error}
            </p>
          )}
          <p className={modal.pending} role="status">
            {busy ? "Removendo telefone…" : ""}
          </p>
          <div className={modal.footer}>
            <AlertDialogCancel
              ref={cancelRef}
              className="button"
              disabled={busy}
            >
              Cancelar
            </AlertDialogCancel>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (await act("remove")) setConfirmOpen(false);
              }}
            >
              Remover telefone
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
