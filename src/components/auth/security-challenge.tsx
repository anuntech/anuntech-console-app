"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/auth-client";
import type { SecurityChannel } from "@/lib/auth/security-policy";
import { securityRequest } from "@/components/auth/security-request";
import { AuthAlert } from "./feedback";
import { CodeInput } from "./login-form";
import { useCooldown } from "./otp";

/** Second step after the code: another code on the other verified contact. */
export function SecurityChallenge() {
  const router = useRouter();
  const id = useId();
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
  const errorId = `${id}-error`;
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
  async function act(action: "send" | "verify" | "cancel", candidate = code) {
    if (busy || (action === "send" && seconds > 0)) return;
    if (action === "verify" && candidate.length !== 6) return;
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
          : await authClient.twoFactor.verifyOtp({ code: candidate });
      if (result.error)
        throw new Error(
          result.error.status === 429
            ? result.error.message ||
                "Muitas tentativas. Aguarde antes de tentar novamente."
            : action === "verify"
              ? "Código inválido ou expirado. Confira o código ou peça outro."
              : "Não foi possível entregar o código. Aguarde e tente reenviar.",
        );
      if (action === "send") {
        setSent(true);
        setCode("");
        cooldown();
        setMessage("Código enviado. Ele vale por 5 minutos.");
      } else {
        setMessage("Verificação concluída. Abrindo o painel.");
        router.replace("/painel");
        router.refresh();
      }
    } catch (cause) {
      if (action === "verify") {
        setInvalidCode(true);
        setCode("");
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
    <div className="flex flex-col gap-5">
      {challenge && (
        <p className="text-sm text-muted-foreground">
          Enviamos um código para o{" "}
          {challenge.channel === "email" ? "e-mail" : "WhatsApp"}{" "}
          <span className="font-medium text-foreground">{challenge.destination}</span>
          {sent ? "." : " assim que você pedir."}
        </p>
      )}
      {!expired && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act(sent ? "verify" : "send");
          }}
        >
          {sent && (
            <div>
              <Label htmlFor={`${id}-code`} className="mb-2">
                Código da segunda etapa
              </Label>
              <CodeInput
                value={code}
                onChange={(next) => {
                  setCode(next);
                  if (invalidCode) setInvalidCode(false);
                }}
                onComplete={() => void act("verify")}
                disabled={busy}
                invalid={invalidCode}
                describedBy={error ? errorId : undefined}
                autoFocus
              />
            </div>
          )}
          {error && (
            <AuthAlert kind="error" id={errorId}>
              {error}
            </AuthAlert>
          )}
          {message && <AuthAlert kind="info">{message}</AuthAlert>}
          <Button
            type="submit"
            className="w-full"
            disabled={busy || !challenge || (sent && code.length !== 6)}
          >
            {busy && <Loader2Icon className="animate-spin" />}
            {busy ? "Aguarde…" : sent ? "Concluir acesso" : "Receber código"}
          </Button>
          <div className="flex items-center justify-center gap-1">
            {sent && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={busy || seconds > 0}
                onClick={() => void act("send")}
              >
                {seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={busy}
              onClick={() => void act("cancel")}
            >
              Voltar para entrar
            </Button>
          </div>
        </form>
      )}
      {expired && (
        <>
          <AuthAlert kind="error" id={errorId}>
            {error}
          </AuthAlert>
          <Button className="w-full" asChild>
            <Link href="/entrar">Entrar novamente</Link>
          </Button>
        </>
      )}
      <p className="sr-only" role="status">
        {busy
          ? "Conferindo o código."
          : !challenge && !expired
            ? "Preparando a verificação."
            : ""}
      </p>
    </div>
  );
}
