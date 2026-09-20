"use client";
import { Notification } from "./notifications";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Field } from "./ui";
import { GoogleButton } from "./auth-buttons";
import { ArrowRight, Mail, MessageCircle } from "lucide-react";
import styles from "./auth.module.css";

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return value.trim().startsWith("+") ? `+${digits}` : `+55${digits}`;
}
export function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, () => setSeconds(60)] as const;
}
export function OtpLogin() {
  const router = useRouter();
  const id = useId();
  const destinationInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"email" | "whatsapp">("email");
  const [destination, setDestination] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<
    "destination" | "code" | null
  >(null);
  const [message, setMessage] = useState("");
  const [seconds, startCooldown] = useCooldown();
  const errorId = `${id}-error`;
  const statusId = `${id}-status`;
  function clearFeedback() {
    setError("");
    setInvalidField(null);
    setMessage("");
  }
  async function send() {
    if (busy || seconds > 0) return;
    setBusy(true);
    clearFeedback();
    try {
      const result =
        mode === "email"
          ? await authClient.emailOtp.sendVerificationOtp({
              email: destination.trim().toLowerCase(),
              type: "sign-in",
            })
          : await authClient.phoneNumber.sendOtp({
              phoneNumber: normalizePhone(destination),
            });
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Aguarde um minuto antes de pedir outro código."
            : "Não foi possível enviar. Confira os dados e tente novamente.",
        );
        if (result.error.status !== 429) {
          setInvalidField("destination");
          destinationInput.current?.focus();
        }
        return;
      }
      setMessage(
        `Se o acesso estiver autorizado, você receberá um código ${mode === "email" ? "no seu e-mail" : "no seu WhatsApp"}. Ele vale por 5 minutos.`,
      );
      setSent(true);
      setCode("");
      startCooldown();
      requestAnimationFrame(() => codeInput.current?.focus());
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (busy) return;
    setBusy(true);
    clearFeedback();
    try {
      const result =
        mode === "email"
          ? await authClient.signIn.emailOtp({
              email: destination.trim().toLowerCase(),
              otp: code,
            })
          : await authClient.phoneNumber.verify({
              phoneNumber: normalizePhone(destination),
              code,
            });
      if (result.error) {
        setError(
          "Código inválido ou expirado. Confira o código ou solicite outro.",
        );
        setInvalidField("code");
        codeInput.current?.focus();
        return;
      }
      if (
        result.data &&
        "twoFactorRedirect" in result.data &&
        result.data.twoFactorRedirect
      ) {
        setMessage("Primeira etapa confirmada. Continue a verificação.");
        router.replace("/verificar-acesso");
        return;
      }
      setMessage("Acesso confirmado. Abrindo o painel.");
      router.replace("/painel");
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className={styles.methods} role="group" aria-label="Forma de acesso">
        {(["email", "whatsapp"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={mode === item}
            aria-disabled={busy}
            onClick={() => {
              if (busy || mode === item) return;
              setMode(item);
              setDestination("");
              setSent(false);
              setCode("");
              clearFeedback();
            }}
          >
            {item === "email" ? (
              <Mail size={15} aria-hidden="true" />
            ) : (
              <MessageCircle size={15} aria-hidden="true" />
            )}
            {item === "email" ? "E-mail" : "WhatsApp"}
          </button>
        ))}
      </div>
      <form
        className={styles.form}
        aria-label={`Acesso por ${mode === "email" ? "e-mail" : "WhatsApp"}`}
        onSubmit={(event) => {
          event.preventDefault();
          void (sent ? verify() : send());
        }}
      >
        <Field
          key={mode}
          label={mode === "email" ? "Seu e-mail" : "Seu WhatsApp"}
          hint={
            mode === "whatsapp"
              ? "Use o número já vinculado em Minha conta. Inclua o DDD; para outro país, comece com + e o DDI."
              : undefined
          }
        >
          <input
            ref={destinationInput}
            id={`${id}-destination`}
            name={mode === "email" ? "email" : "phone"}
            type={mode === "email" ? "email" : "tel"}
            autoComplete={mode === "email" ? "email" : "tel"}
            autoCapitalize="none"
            spellCheck={false}
            placeholder={
              mode === "email" ? "voce@empresa.com.br" : "(11) 99999-9999"
            }
            required
            maxLength={254}
            value={destination}
            readOnly={sent || busy}
            aria-invalid={invalidField === "destination" || undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setDestination(event.target.value);
              if (invalidField === "destination") clearFeedback();
            }}
          />
        </Field>
        {sent && (
          <Field
            label="Código de acesso"
            hint="Digite os 6 números do código. Ele é válido por 5 minutos."
          >
            <input
              ref={codeInput}
              id={`${id}-code`}
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
              required
              readOnly={busy}
              value={code}
              aria-invalid={invalidField === "code" || undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ""));
                if (invalidField === "code") clearFeedback();
              }}
              className={styles.code}
            />
          </Field>
        )}
        {error && <Notification id={errorId} kind="error" message={error} />}
        {message && (
          <Notification id={statusId} kind="info" message={message} />
        )}
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {busy ? "Processando sua solicitação de acesso. Aguarde." : ""}
        </p>
        <button
          className="button primary"
          aria-disabled={busy || (!sent && seconds > 0)}
          aria-describedby={error ? errorId : message ? statusId : undefined}
        >
          {busy
            ? "Aguarde…"
            : sent
              ? "Entrar"
              : seconds
                ? "Aguarde para reenviar"
                : "Receber código"}
          {!busy && !seconds && <ArrowRight size={16} aria-hidden="true" />}
        </button>
        {sent && (
          <div className={styles.actions}>
            <button
              type="button"
              aria-disabled={busy || seconds > 0}
              aria-label={
                seconds
                  ? "Reenviar código. Aguarde um minuto entre envios."
                  : "Reenviar código"
              }
              onClick={() => void send()}
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
                requestAnimationFrame(() => destinationInput.current?.focus());
              }}
            >
              Alterar {mode === "email" ? "e-mail" : "número"}
            </button>
          </div>
        )}
      </form>
      {mode === "whatsapp" && (
        <p className={styles.hint}>
          Primeiro acesso? Entre por e-mail e vincule seu WhatsApp em Minha
          conta.
        </p>
      )}
      <div className={styles.divider}>ou continue com</div>
      <GoogleButton />
    </>
  );
}
