"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Field } from "./ui";
import { GoogleButton } from "./auth-buttons";

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
  const [mode, setMode] = useState<"email" | "whatsapp">("email");
  const [destination, setDestination] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seconds, startCooldown] = useCooldown();
  async function send() {
    setBusy(true);
    setError("");
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
        return;
      }
      setSent(true);
      setCode("");
      startCooldown();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    setError("");
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
        return;
      }
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
      <div className="auth-methods" aria-label="Forma de acesso">
        {(["email", "whatsapp"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={mode === item}
            disabled={busy}
            onClick={() => {
              setMode(item);
              setDestination("");
              setSent(false);
              setCode("");
              setError("");
            }}
          >
            {item === "email" ? "E-mail" : "WhatsApp"}
          </button>
        ))}
      </div>
      <form
        className="form otp-form"
        onSubmit={(e) => {
          e.preventDefault();
          void (sent ? verify() : send());
        }}
      >
        <Field
          label={mode === "email" ? "Seu e-mail" : "Seu WhatsApp"}
          hint={
            mode === "whatsapp"
              ? "Use o número já vinculado em Minha conta. Inclua o DDD; para outro país, comece com + e o DDI."
              : undefined
          }
        >
          <input
            type={mode === "email" ? "email" : "tel"}
            autoComplete={mode === "email" ? "email" : "tel"}
            placeholder={
              mode === "email" ? "voce@empresa.com.br" : "(11) 99999-9999"
            }
            required
            maxLength={254}
            value={destination}
            readOnly={sent}
            disabled={busy}
            onChange={(e) => setDestination(e.target.value)}
          />
        </Field>
        {sent && (
          <>
            <p className="auth-hint" role="status">
              Se o acesso estiver autorizado, você receberá um código{" "}
              {mode === "email" ? "no seu e-mail" : "no seu WhatsApp"}. Ele vale
              por 5 minutos.
            </p>
            <Field label="Código de acesso">
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                minLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="otp-code"
              />
            </Field>
          </>
        )}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary"
          disabled={busy || (!sent && seconds > 0)}
        >
          {busy
            ? "Aguarde…"
            : sent
              ? "Entrar"
              : seconds
                ? `Aguarde ${seconds}s`
                : "Receber código"}
        </button>
        {sent && (
          <div className="otp-actions">
            <button
              type="button"
              disabled={busy || seconds > 0}
              onClick={() => void send()}
            >
              {seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
                setError("");
              }}
            >
              Alterar {mode === "email" ? "e-mail" : "número"}
            </button>
          </div>
        )}
      </form>
      {mode === "whatsapp" && (
        <p className="auth-hint">
          Primeiro acesso? Entre por e-mail e vincule seu WhatsApp em Minha
          conta.
        </p>
      )}
      <div className="auth-divider">ou</div>
      <GoogleButton />
    </>
  );
}
