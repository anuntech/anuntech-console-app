"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Badge, Field } from "./ui";
import { Notification } from "./notifications";
import { useCooldown } from "./otp-login";
import { securityRequest } from "./security-request";
import type { SecurityChannel } from "@/lib/security-policy";
import styles from "./security.module.css";

type Proof = { changeId: string; stage: SecurityChannel; destination: string };
export function SecuritySettings({
  enabled,
  channel,
  email,
  phone,
}: {
  enabled: boolean;
  channel: SecurityChannel;
  email: string;
  phone: string | null;
}) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const stepHeading = useRef<HTMLParagraphElement>(null);
  const [invalidCode, setInvalidCode] = useState(false);
  const [preferred, setPreferred] = useState(channel);
  const [proof, setProof] = useState<Proof | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [seconds, cooldown] = useCooldown();
  const cooldownChannel = useRef<SecurityChannel | null>(null);
  async function act(
    action: "enable" | "disable" | "channel" | "send" | "verify",
  ) {
    if (busy) return;
    if (
      action === "send" &&
      seconds > 0 &&
      cooldownChannel.current === proof?.stage
    ) {
      setError("Aguarde um minuto entre envios para o mesmo contato.");
      return;
    }
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
        setMessage(
          `Código enviado por ${proof.stage === "email" ? "e-mail" : "WhatsApp"}.`,
        );
        requestAnimationFrame(() => input.current?.focus());
      } else if (action === "verify" && proof) {
        const result = await securityRequest<{
          complete?: true;
          stage?: SecurityChannel;
          destination?: string;
        }>("verify-change", { changeId: proof.changeId, code });
        if (result.complete) {
          setProof(null);
          setMessage(
            "Configuração de segurança atualizada. As outras sessões foram encerradas.",
          );
          router.refresh();
          heading.current?.focus();
        } else {
          setProof({
            ...proof,
            stage: result.stage!,
            destination: result.destination!,
          });
          setSent(false);
          setCode("");
          setMessage(
            "E-mail confirmado. Agora confirme seu WhatsApp para concluir.",
          );
          requestAnimationFrame(() => stepHeading.current?.focus());
          // Channels have separate server cooldowns; the next explicit send is allowed.
        }
      } else if (
        action === "enable" ||
        action === "disable" ||
        action === "channel"
      ) {
        const result = await securityRequest<Proof>("start-change", {
          action,
          channel: preferred,
        });
        setProof(result);
        requestAnimationFrame(() => stepHeading.current?.focus());
        setSent(false);
        setCode("");
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
    <section className={styles.settings} aria-labelledby={`${id}-title`}>
      <div className={styles.heading}>
        <h3 id={`${id}-title`} tabIndex={-1} ref={heading}>
          <ShieldCheck size={18} aria-hidden="true" /> Verificação em duas
          etapas
        </h3>
        <Badge status={enabled ? "active" : ""}>
          {enabled ? "Ativada" : "Desativada"}
        </Badge>
      </div>
      <p className="muted">
        Ao entrar por e-mail, confirme também um código no WhatsApp. Ao entrar
        pelo WhatsApp, confirme um código no e-mail. Seu acesso continua sem
        senha.
      </p>
      {!phone ? (
        <p className="muted">
          Confirme seu WhatsApp acima para ativar. Você precisa manter acesso ao
          e-mail {email} e ao número vinculado.
        </p>
      ) : (
        <>
          <p className="muted">
            Para alterar esta proteção, confirme códigos nos dois contatos.
            Enquanto estiver ativa, desative-a antes de alterar seus contatos.
          </p>
          {!proof ? (
            <div className="form">
              <Field label="Segunda etapa ao entrar com Google">
                <select
                  value={preferred}
                  onChange={(event) =>
                    setPreferred(event.target.value as SecurityChannel)
                  }
                  disabled={busy}
                >
                  <option value="whatsapp">Código no WhatsApp</option>
                  <option value="email">Código no e-mail</option>
                </select>
              </Field>
              <div className={styles.actions}>
                <button
                  className={`button ${enabled ? "danger" : "primary"}`}
                  type="button"
                  aria-disabled={busy}
                  onClick={() => void act(enabled ? "disable" : "enable")}
                >
                  {enabled ? "Desativar duas etapas" : "Ativar duas etapas"}
                </button>
                {enabled && preferred !== channel && (
                  <button
                    className="button"
                    type="button"
                    aria-disabled={busy}
                    onClick={() => void act("channel")}
                  >
                    Alterar canal do Google
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form
              className="form"
              aria-label="Confirmar alteração de segurança"
              onSubmit={(event) => {
                event.preventDefault();
                void act(sent ? "verify" : "send");
              }}
            >
              <p ref={stepHeading} tabIndex={-1}>
                <strong>
                  {proof.stage === "email"
                    ? "1 de 2 · Confirme seu e-mail"
                    : "2 de 2 · Confirme seu WhatsApp"}
                </strong>
                <br />
                {proof.destination}
              </p>
              {sent && (
                <Field
                  label="Código de confirmação"
                  hint="Digite os 6 números recebidos. Válido por 5 minutos."
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
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </Field>
              )}
              <div className={styles.actions}>
                <button className="button primary" aria-disabled={busy}>
                  {busy
                    ? "Aguarde…"
                    : sent
                      ? "Confirmar código"
                      : "Receber código"}
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
                  onClick={() => {
                    if (!busy) {
                      setProof(null);
                      setError("");
                      setMessage("");
                      heading.current?.focus();
                    }
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {error && (
        <Notification id={`${id}-error`} kind="error" message={error} />
      )}
      {message && <Notification kind="info" message={message} />}
      <p className="sr-only" role="status">
        {busy ? "Processando a verificação. Aguarde." : ""}
      </p>
    </section>
  );
}
