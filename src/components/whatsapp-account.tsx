"use client";
import { toast } from "./notifications";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Field, focusFirstInvalid } from "./field";
import { formatPhone } from "@/lib/company-input";
import { normalizePhone, useCooldown } from "./auth/otp";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "./legacy-ui/alert-dialog";
import modal from "./legacy-ui/modal.module.css";
import styles from "./preferences/account-fields.module.css";

/** Brazilian numbers get the local mask; another DDI stays exactly as typed. */
function maskPhone(value: string) {
  const trimmed = value.trimStart();
  return /^\+(?!55)/.test(trimmed)
    ? trimmed.slice(0, 25)
    : formatPhone(trimmed);
}

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
  const [number, setNumber] = useState(maskPhone(phone || ""));
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
    setNumber(maskPhone(saved));
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
          toast.error(
            "Não foi possível validar sua sessão. Entre na conta novamente e refaça a alteração.",
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
        setNumber(maskPhone(next));
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
        data-account-order="2"
        // While a code is pending this step owns its confirm button, so the
        // shared Salvar must not submit this form too.
        data-account-changed={changed && !securityEnabled && !sent}
        data-account-attention={sent || confirmOpen || !!error}
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
              setNumber(maskPhone(event.target.value));
              clearFeedback();
            }}
          />
        </Field>
        {sent && (
          <Field
            label="Código de confirmação"
            hint={
              <>
                Digite os 6 números recebidos. Válido por 5 minutos. Não
                chegou?{" "}
                <button
                  type="button"
                  className={styles.resend}
                  disabled={busy || seconds > 0}
                  onClick={() => void act("send")}
                >
                  {seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
                </button>
              </>
            }
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
        {!securityEnabled && (
          <div className={styles.actions} data-verification={sent || undefined}>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={cancel}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={
                busy || !changed || (!sent && seconds > 0 && !!normalized)
              }
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
            ? ""
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
          <p className="sr-only" role="status">
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
