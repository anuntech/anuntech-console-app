"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  ArrowRightIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth/auth-client";
import { afterSignIn, withReturnPath } from "@/lib/auth/return-path";
import { AuthAlert } from "./feedback";
import { BrandLoading } from "@/components/shell/brand-loading";
import { GoogleButton } from "./google-button";
import { normalizePhone, useCooldown } from "./otp";

type Mode = "email" | "whatsapp";

/** A six-digit code, split in two groups so it reads like the message. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  describedBy,
  autoFocus,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      pattern={REGEXP_ONLY_DIGITS}
      autoComplete="one-time-code"
      inputMode="numeric"
      autoFocus={autoFocus}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      containerClassName="justify-between"
    >
      <InputOTPGroup>
        {[0, 1, 2].map((index) => (
          <InputOTPSlot key={index} index={index} className="h-12 w-11 text-lg" />
        ))}
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        {[3, 4, 5].map((index) => (
          <InputOTPSlot key={index} index={index} className="h-12 w-11 text-lg" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/**
 * Sign in with a one-time code by e-mail or WhatsApp, or with Google. Two
 * steps on one card: where to send the code, then the code itself.
 */
export function LoginForm({
  preview,
  returnTo,
}: {
  /** Design previews only: start on the code step for this destination. */
  preview?: { destination: string };
  /** Where to go once signed in (an app the person tried to open); checked again here. */
  returnTo?: string | null;
} = {}) {
  const router = useRouter();
  const id = useId();
  const destinationInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("email");
  const [destination, setDestination] = useState(preview?.destination ?? "");
  const [sent, setSent] = useState(!!preview);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<"destination" | "code" | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [seconds, startCooldown] = useCooldown();
  const errorId = `${id}-error`;
  const statusId = `${id}-status`;
  const describedBy = error ? errorId : message ? statusId : undefined;

  function clearFeedback() {
    setError("");
    setInvalidField(null);
    setMessage("");
  }
  function switchMode(next: Mode) {
    if (busy || next === mode) return;
    setMode(next);
    setDestination("");
    setSent(false);
    setCode("");
    clearFeedback();
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
        `Se o acesso estiver autorizado, o código chega ${mode === "email" ? "no seu e-mail" : "no seu WhatsApp"} e vale por 5 minutos.`,
      );
      setSent(true);
      setCode("");
      startCooldown();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(candidate = code) {
    if (busy || candidate.length !== 6) return;
    setBusy(true);
    clearFeedback();
    try {
      const result =
        mode === "email"
          ? await authClient.signIn.emailOtp({
              email: destination.trim().toLowerCase(),
              otp: candidate,
            })
          : await authClient.phoneNumber.verify({
              phoneNumber: normalizePhone(destination),
              code: candidate,
            });
      if (result.error) {
        setError("Código inválido ou expirado. Confira o código ou peça outro.");
        setInvalidField("code");
        setCode("");
        return;
      }
      if (
        result.data &&
        "twoFactorRedirect" in result.data &&
        result.data.twoFactorRedirect
      ) {
        setMessage("Primeira etapa confirmada. Continue a verificação.");
        router.replace(withReturnPath("/verificar-acesso", returnTo));
        return;
      }
      const next = afterSignIn(returnTo);
      setMessage(next === "/painel" ? "Acesso confirmado. Abrindo o painel." : "Acesso confirmado. Abrindo o app.");
      setOpening(true);
      router.replace(next);
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {opening && (
        <BrandLoading fullscreen label="Acesso confirmado. Abrindo o Console." />
      )}
      {!sent && (
        <Tabs value={mode} onValueChange={(value) => switchMode(value as Mode)}>
          <TabsList aria-label="Forma de acesso" className="grid w-full grid-cols-2">
            <TabsTrigger value="email" disabled={busy}>
              <MailIcon />
              E-mail
            </TabsTrigger>
            <TabsTrigger value="whatsapp" disabled={busy}>
              <MessageCircleIcon />
              WhatsApp
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <form
        aria-label={`Acesso por ${mode === "email" ? "e-mail" : "WhatsApp"}`}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void (sent ? verify() : send());
        }}
      >
        {sent ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/50 py-2 pr-1.5 pl-3 text-sm">
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">
                Código enviado para
              </span>
              <span className="block truncate font-medium text-foreground">
                {destination}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
                clearFeedback();
                requestAnimationFrame(() => destinationInput.current?.focus());
              }}
            >
              Alterar
            </Button>
          </div>
        ) : (
          <div>
            <Label htmlFor={`${id}-destination`} className="mb-1.5">
              {mode === "email" ? "Seu e-mail" : "Seu WhatsApp"}
            </Label>
            <Input
              key={mode}
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
              className="h-11 rounded-xl px-4"
              required
              maxLength={254}
              value={destination}
              readOnly={busy}
              autoFocus
              aria-invalid={invalidField === "destination" || undefined}
              aria-describedby={describedBy}
              onChange={(event) => {
                setDestination(event.target.value);
                if (invalidField === "destination") clearFeedback();
              }}
            />
            {mode === "whatsapp" && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Use o número já vinculado em Minha conta, com DDD. Primeiro
                acesso? Entre por e-mail e vincule o WhatsApp depois.
              </p>
            )}
          </div>
        )}
        {sent && (
          <div>
            <Label htmlFor={`${id}-code`} className="mb-2">
              Código de acesso
            </Label>
            <CodeInput
              value={code}
              onChange={(next) => {
                setCode(next);
                if (invalidField === "code") clearFeedback();
              }}
              onComplete={() => void verify()}
              disabled={busy}
              invalid={invalidField === "code"}
              describedBy={describedBy}
              autoFocus
            />
          </div>
        )}
        {error && (
          <AuthAlert kind="error" id={errorId}>
            {error}
          </AuthAlert>
        )}
        {message && (
          <AuthAlert kind="info" id={statusId}>
            {message}
          </AuthAlert>
        )}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {busy ? (sent ? "Conferindo o código." : "Enviando o código.") : ""}
        </p>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy || (!sent && seconds > 0) || (sent && code.length !== 6)}
          aria-describedby={describedBy}
        >
          {busy ? (
            <Loader2Icon className="animate-spin" />
          ) : null}
          {busy
            ? "Aguarde…"
            : sent
              ? "Entrar"
              : seconds
                ? `Aguarde ${seconds}s para pedir outro código`
                : "Receber código"}
          {!busy && !seconds && <ArrowRightIcon />}
        </Button>
        {sent && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={busy || seconds > 0}
              onClick={() => void send()}
            >
              {seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
            </Button>
          </div>
        )}
      </form>
      {!sent && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            ou
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <GoogleButton returnTo={returnTo} />
        </>
      )}
    </div>
  );
}
