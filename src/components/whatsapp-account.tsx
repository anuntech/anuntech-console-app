"use client";
import { Notification } from "./notifications";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Field, Badge } from "./ui";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { normalizePhone, useCooldown } from "./otp-login";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import modalStyles from "./ui/modal.module.css";

export function WhatsappAccount({
  phone,
  className = "",
}: {
  phone: string | null;
  className?: string;
}) {
  const router = useRouter();
  const id = useId();
  const numberInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const unlinked = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<"number" | "code" | null>(
    null,
  );
  const [seconds, startCooldown] = useCooldown();
  const errorId = `${id}-error`;
  function clearFeedback() {
    setError("");
    setInvalidField(null);
    setMessage("");
  }
  async function act(action: "send" | "verify" | "remove") {
    if (busy || (action === "send" && seconds > 0)) return false;
    setBusy(true);
    clearFeedback();
    try {
      const result =
        action === "send"
          ? await authClient.phoneNumber.sendOtp(
              { phoneNumber: normalizePhone(number) },
              { headers: { "x-console-purpose": "bind" } },
            )
          : action === "verify"
            ? await authClient.phoneNumber.verify({
                phoneNumber: normalizePhone(number),
                code,
                updatePhoneNumber: true,
                disableSession: true,
              })
            : await authClient.updateUser({ phoneNumber: null });
      if (result.error) {
        setError(
          result.error.status === 401
            ? "Para alterar seu WhatsApp, saia e entre novamente por e-mail ou Google. Faça a vinculação nos primeiros 10 minutos após entrar."
            : result.error.status === 429
              ? "Aguarde antes de pedir outro código."
              : "Não foi possível concluir. Confira o número e o código. O número não pode estar vinculado a outra conta.",
        );
        if (
          result.error.status !== 401 &&
          result.error.status !== 429 &&
          action !== "remove"
        ) {
          setInvalidField(action === "verify" ? "code" : "number");
          (action === "verify" ? codeInput : numberInput).current?.focus();
        }
        return false;
      }
      if (action === "send") {
        setSent(true);
        setCode("");
        startCooldown();
        setMessage("Código enviado. Ele vale por 5 minutos.");
        requestAnimationFrame(() => codeInput.current?.focus());
      } else {
        setSent(false);
        setCode("");
        setNumber("");
        setMessage(
          action === "remove"
            ? "WhatsApp desvinculado."
            : "WhatsApp confirmado. Você já pode usá-lo para entrar.",
        );
        if (action === "remove") unlinked.current = true;
        else heading.current?.focus();
        router.refresh();
      }
      return true;
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`panel form-panel whatsapp-settings ${className}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="card-top">
        <h2
          ref={heading}
          id={`${id}-title`}
          className="detail-section-title"
          tabIndex={-1}
        >
          <MessageCircle size={20} aria-hidden="true" /> Acesso pelo WhatsApp
        </h2>
        <Badge status={phone ? "active" : ""}>
          {phone ? "Vinculado" : "Não vinculado"}
        </Badge>
      </div>
      <p className="muted">
        Confirme seu número para entrar usando um código recebido pelo WhatsApp.
        Seu e-mail continuará disponível para acesso.
      </p>
      {phone ? (
        <div className="form">
          <p className="verified-number">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              <small>Número verificado</small>
              <strong>{phone}</strong>
            </span>
          </p>
          <button
            ref={removeTrigger}
            type="button"
            className="button danger"
            aria-haspopup="dialog"
            aria-disabled={busy}
            onClick={() => {
              if (busy) return;
              unlinked.current = false;
              clearFeedback();
              setConfirmOpen(true);
            }}
          >
            Desvincular WhatsApp
          </button>
        </div>
      ) : (
        <form
          className="form"
          aria-label="Vincular WhatsApp"
          onSubmit={(event) => {
            event.preventDefault();
            void act(sent ? "verify" : "send");
          }}
        >
          <Field
            label="Seu número com DDD"
            hint="Para outro país, comece com + e o DDI."
          >
            <input
              ref={numberInput}
              id={`${id}-number`}
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={25}
              readOnly={sent || busy}
              placeholder="(11) 99999-9999"
              value={number}
              aria-invalid={invalidField === "number" || undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setNumber(event.target.value);
                if (invalidField === "number") clearFeedback();
              }}
            />
          </Field>
          {sent && (
            <Field
              label="Código recebido"
              hint="Digite os 6 números enviados pelo WhatsApp. O código vale por 5 minutos."
            >
              <input
                ref={codeInput}
                id={`${id}-code`}
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                readOnly={busy}
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                value={code}
                aria-invalid={invalidField === "code" || undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, ""));
                  if (invalidField === "code") clearFeedback();
                }}
              />
            </Field>
          )}
          <button
            className="button primary"
            aria-disabled={busy || (!sent && seconds > 0)}
          >
            {busy
              ? "Aguarde…"
              : sent
                ? "Confirmar WhatsApp"
                : seconds
                  ? "Aguarde para reenviar"
                  : "Receber código no WhatsApp"}
          </button>
          {sent && (
            <div className="otp-actions">
              <button
                type="button"
                aria-disabled={busy || seconds > 0}
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
              <button
                type="button"
                aria-disabled={busy}
                onClick={() => {
                  if (busy) return;
                  setSent(false);
                  setCode("");
                  clearFeedback();
                  requestAnimationFrame(() => numberInput.current?.focus());
                }}
              >
                Alterar número
              </button>
            </div>
          )}
        </form>
      )}
      {error && !confirmOpen && (
        <Notification id={errorId} kind="error" message={error} />
      )}
      {message && (
        <Notification kind={sent ? "info" : "success"} message={message} />
      )}
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {busy && !confirmOpen
          ? "Processando sua solicitação de WhatsApp. Aguarde."
          : ""}
      </p>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open, details) => {
          if (busy) details.cancel();
          else setConfirmOpen(open);
        }}
      >
        <AlertDialogContent
          initialFocus={cancelButton}
          finalFocus={() =>
            unlinked.current ? heading.current : removeTrigger.current
          }
        >
          <div className={modalStyles.header}>
            <AlertDialogTitle className={modalStyles.title}>
              Desvincular WhatsApp?
            </AlertDialogTitle>
            <AlertDialogDescription className={modalStyles.description}>
              O número {phone} deixará de ser usado para entrar. Você poderá
              continuar acessando por e-mail ou Google.
            </AlertDialogDescription>
          </div>
          {error && <Notification id={errorId} kind="error" message={error} />}
          <p className={modalStyles.pending} role="status">
            {busy ? "Desvinculando WhatsApp…" : ""}
          </p>
          <div className={modalStyles.footer}>
            <AlertDialogCancel
              ref={cancelButton}
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
              Desvincular WhatsApp
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
