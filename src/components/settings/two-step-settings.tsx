"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, MailIcon, MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionTitle } from "@/components/console/page-header";
import { AuthAlert } from "@/components/auth/feedback";
import { FormAlert } from "@/components/console/server-form";
import { CodeInput } from "@/components/auth/login-form";
import { useCooldown } from "@/components/auth/otp";
import { securityRequest } from "@/components/security-request";
import { toast } from "@/components/notifications";
import type { SecurityChannel } from "@/lib/security-policy";

type Proof = { changeId: string; stage: SecurityChannel; destination: string };

/**
 * Two-step verification: which channel confirms sign-ins. Any change is
 * itself confirmed with a code on the e-mail and then on WhatsApp.
 */
export function TwoStepSettings({
  enabled,
  channel,
  phone,
}: {
  enabled: boolean;
  channel: SecurityChannel;
  phone: string | null;
}) {
  const router = useRouter();
  const id = useId();
  const [proof, setProof] = useState<Proof | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalidCode, setInvalidCode] = useState(false);
  const [message, setMessage] = useState("");
  const [seconds, cooldown] = useCooldown();
  const cooldownChannel = useRef<SecurityChannel | null>(null);
  const errorId = `${id}-error`;

  async function act(
    action: "enable" | "disable" | "channel" | "send" | "verify",
    selected: SecurityChannel = channel,
    candidate = code,
  ) {
    if (busy) return;
    if (action === "send" && seconds > 0 && cooldownChannel.current === proof?.stage) {
      setError("Aguarde um minuto entre envios para o mesmo contato.");
      return;
    }
    if (action === "verify" && candidate.length !== 6) return;
    setBusy(true);
    setError("");
    setInvalidCode(false);
    setMessage("");
    try {
      if (action === "send" && proof) {
        await securityRequest("send-change", { changeId: proof.changeId });
        setSent(true);
        setCode("");
        cooldown();
        cooldownChannel.current = proof.stage;
        setMessage(`Código enviado por ${proof.stage === "email" ? "e-mail" : "WhatsApp"}.`);
      } else if (action === "verify" && proof) {
        const result = await securityRequest<{
          complete?: true;
          stage?: SecurityChannel;
          destination?: string;
        }>("verify-change", { changeId: proof.changeId, code: candidate });
        if (result.complete) {
          setProof(null);
          setSent(false);
          setCode("");
          toast.success(
            "Configuração de segurança atualizada. As outras sessões foram encerradas.",
          );
          router.refresh();
        } else {
          setProof({ ...proof, stage: result.stage!, destination: result.destination! });
          setSent(false);
          setCode("");
          setMessage("E-mail confirmado. Agora confirme seu WhatsApp para concluir.");
        }
      } else if (action === "enable" || action === "disable" || action === "channel") {
        const result = await securityRequest<Proof>("start-change", {
          action,
          channel: selected,
        });
        setProof(result);
        setSent(false);
        setCode("");
      }
    } catch (cause) {
      if (action === "verify") {
        setInvalidCode(true);
        setCode("");
      }
      setError(
        cause instanceof Error ? cause.message : "Não foi possível conectar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title={
            <span className="flex items-center gap-2">
              Verificação em duas etapas
              <span
                className={
                  enabled
                    ? "rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success"
                    : "rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground"
                }
              >
                {enabled ? "Ativada" : "Desativada"}
              </span>
            </span>
          }
          description="Ao entrar, um segundo código confirma que é você. Escolha por onde ele chega."
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Same block as every form error; the id wraps it so the code field can point at it. */}
        {error && (
          <div id={errorId}>
            <FormAlert>{error}</FormAlert>
          </div>
        )}
        {!phone && (
          <AuthAlert kind="info">
            Vincule seu WhatsApp em Minha conta para ativar a verificação.
          </AuthAlert>
        )}
        {!proof ? (
          <ul className="divide-y rounded-lg border">
            {(
              [
                { value: "email", label: "E-mail", icon: <MailIcon /> },
                { value: "whatsapp", label: "WhatsApp", icon: <MessageCircleIcon /> },
              ] as const
            ).map((option) => {
              const active = enabled && channel === option.value;
              const switchId = `${id}-${option.value}`;
              return (
                <li
                  key={option.value}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <Label htmlFor={switchId} className="gap-3 text-sm [&_svg]:size-4 [&_svg]:text-muted-foreground">
                    {option.icon}
                    {option.label}
                  </Label>
                  <Switch
                    id={switchId}
                    checked={active}
                    disabled={busy || !phone}
                    aria-label={`${active ? "Desativar" : "Ativar"} verificação por ${option.label}`}
                    onCheckedChange={() =>
                      void act(active ? "disable" : enabled ? "channel" : "enable", option.value)
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <form
            className="flex flex-col gap-4 rounded-lg border bg-secondary/40 p-4"
            aria-label="Confirmar alteração de segurança"
            onSubmit={(event) => {
              event.preventDefault();
              void act(sent ? "verify" : "send");
            }}
          >
            <p className="text-sm">
              <span className="block font-medium text-foreground">
                {proof.stage === "email"
                  ? "1 de 2 · Confirme seu e-mail"
                  : "2 de 2 · Confirme seu WhatsApp"}
              </span>
              <span className="text-muted-foreground">{proof.destination}</span>
            </p>
            {sent && (
              <div>
                <Label className="mb-2">Código de confirmação</Label>
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
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={busy || (sent && code.length !== 6)}>
                {busy && <Loader2Icon className="animate-spin" />}
                {busy ? "Aguarde…" : sent ? "Confirmar código" : "Receber código"}
              </Button>
              {sent && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || seconds > 0}
                  onClick={() => void act("send")}
                >
                  {seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setProof(null);
                  setSent(false);
                  setCode("");
                  setError("");
                  setMessage("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
        {message && <AuthAlert kind="info">{message}</AuthAlert>}
        <p className="sr-only" role="status">
          {busy ? "Processando a verificação. Aguarde." : ""}
        </p>
      </CardContent>
    </Card>
  );
}
