"use client";
import { Notification, toast } from "./notifications";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Field, Badge } from "./ui";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { normalizePhone, useCooldown } from "./otp-login";
export function WhatsappAccount({ phone }: { phone: string | null }) {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [seconds, startCooldown] = useCooldown();
  async function act(action: "send" | "verify" | "remove") {
    setBusy(true);
    setError("");
    setMessage("");
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
        return;
      }
      if (action === "send") {
        setSent(true);
        setCode("");
        startCooldown();
        setMessage("Código enviado. Ele vale por 5 minutos.");
      } else {
        setSent(false);
        setCode("");
        setNumber("");
        setMessage(
          action === "remove"
            ? "WhatsApp desvinculado."
            : "WhatsApp confirmado. Você já pode usá-lo para entrar.",
        );
        router.refresh();
      }
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel form-panel whatsapp-settings">
      <div className="card-top">
        <h2 className="detail-section-title">
          <MessageCircle size={20} aria-hidden="true" />
          Acesso pelo WhatsApp
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
            className="button danger"
            disabled={busy}
            onClick={() => {
              toast.warning(
                "Desvincular este WhatsApp? Você poderá continuar entrando por e-mail.",
                {
                  id: "unlink-whatsapp",
                  duration: Infinity,
                  action: {
                    label: "Desvincular",
                    onClick: () => void act("remove"),
                  },
                  cancel: { label: "Cancelar", onClick: () => {} },
                },
              );
            }}
          >
            Desvincular WhatsApp
          </button>
        </div>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void act(sent ? "verify" : "send");
          }}
        >
          <Field
            label="Seu número com DDD"
            hint="Para outro país, comece com + e o DDI."
          >
            <input
              type="tel"
              autoComplete="tel"
              required
              maxLength={25}
              readOnly={sent}
              disabled={busy}
              placeholder="(11) 99999-9999"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </Field>
          {sent && (
            <Field label="Código recebido">
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          )}
          <button
            className="button primary"
            disabled={busy || (!sent && seconds > 0)}
          >
            {busy
              ? "Aguarde…"
              : sent
                ? "Confirmar WhatsApp"
                : seconds
                  ? `Aguarde ${seconds}s`
                  : "Receber código no WhatsApp"}
          </button>
          {sent && (
            <div className="otp-actions">
              <button
                type="button"
                disabled={busy || seconds > 0}
                onClick={() => void act("send")}
              >
                {seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setMessage("");
                }}
              >
                Alterar número
              </button>
            </div>
          )}
        </form>
      )}
      {error && <Notification kind="error" message={error} />}
      {message && <Notification kind="success" message={message} />}
    </section>
  );
}
