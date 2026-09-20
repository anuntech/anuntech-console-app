"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { SecurityChannel } from "@/lib/security-policy";
import { Field } from "./ui";
import { Notification } from "./notifications";
import { useCooldown } from "./otp-login";
import { securityRequest } from "./security-request";
import styles from "./auth.module.css";
export function SecurityChallenge() {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [challenge, setChallenge] = useState<{
    channel: SecurityChannel;
    destination: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalidCode, setInvalidCode] = useState(false);
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);
  const [seconds, cooldown] = useCooldown();
  useEffect(() => {
    let active = true;
    void securityRequest<{ channel: SecurityChannel; destination: string }>(
      "challenge",
    )
      .then((data) => {
        if (active) setChallenge(data);
      })
      .catch(() => {
        if (active) {
          setExpired(true);
          setError(
            "A verificação expirou. Entre novamente para receber novos códigos.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function act(action: "send" | "verify" | "cancel") {
    if (busy || (action === "send" && seconds > 0)) return;
    setBusy(true);
    setError("");
    setInvalidCode(false);
    setMessage("");
    try {
      if (action === "cancel") {
        await securityRequest("cancel", {});
        router.replace("/entrar");
        return;
      }
      const result =
        action === "send"
          ? await authClient.twoFactor.sendOtp({})
          : await authClient.twoFactor.verifyOtp({ code });
      if (result.error)
        throw new Error(
          result.error.status === 429
            ? result.error.message ||
                "Muitas tentativas. Aguarde antes de tentar novamente."
            : action === "verify"
              ? "Código inválido ou expirado. Confira o código ou solicite outro."
              : "Não foi possível entregar o código. Aguarde e tente reenviar.",
        );
      if (action === "send") {
        setSent(true);
        setCode("");
        cooldown();
        setMessage("Código enviado. Ele vale por 5 minutos.");
        requestAnimationFrame(() => input.current?.focus());
      } else {
        setMessage("Verificação concluída. Abrindo o painel.");
        router.replace("/painel");
        router.refresh();
      }
    } catch (cause) {
      if (action === "verify") {
        setInvalidCode(true);
        input.current?.focus();
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível conectar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {challenge && (
        <p className={styles.subtitle}>
          Confirme o código no{" "}
          {challenge.channel === "email" ? "e-mail" : "WhatsApp"}{" "}
          {challenge.destination} para concluir seu acesso.
        </p>
      )}
      {!expired && (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void act(sent ? "verify" : "send");
          }}
        >
          {sent && (
            <Field
              label="Código da segunda etapa"
              hint="Digite os 6 números recebidos."
            >
              <input
                ref={input}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                value={code}
                readOnly={busy}
                aria-invalid={invalidCode || undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className={styles.code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
              />
            </Field>
          )}
          <button
            className="button primary"
            aria-disabled={busy || !challenge}
            onClick={(event) => {
              if (!challenge) event.preventDefault();
            }}
          >
            {busy ? "Aguarde…" : sent ? "Concluir acesso" : "Receber código"}
          </button>
          {sent && (
            <button
              type="button"
              className="button"
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
          )}
          <button
            type="button"
            className="button"
            aria-disabled={busy}
            onClick={() => void act("cancel")}
          >
            Voltar para entrar
          </button>
        </form>
      )}
      {error && (
        <Notification id={`${id}-error`} kind="error" message={error} />
      )}
      {message && <Notification kind="info" message={message} />}
      {expired && (
        <Link href="/entrar" className="button primary">
          Entrar novamente
        </Link>
      )}
      <p className="sr-only" role="status">
        {busy
          ? "Processando sua verificação. Aguarde."
          : !challenge && !expired
            ? "Preparando a verificação."
            : ""}
      </p>
    </>
  );
}
