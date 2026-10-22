import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Notice, Screen } from "@/components/surface";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { CodeField } from "@/components/field";
import { IconTile } from "@/components/tile";
import { authClient, securityChallenge } from "@/lib/auth";
import { space } from "@/lib/theme";

/** The second step: a code on the other verified contact (as /verificar-acesso). */
export default function SecondStep() {
  const [challenge, setChallenge] = useState<{ channel: "email" | "whatsapp"; destination: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    securityChallenge()
      .then(setChallenge)
      .catch(() => setError("A verificação expirou. Entre novamente para receber novos códigos."));
  }, []);

  async function send() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await authClient.twoFactor.sendOtp({});
      if (result.error)
        setError(
          result.error.status === 429
            ? "Aguarde um minuto antes de pedir outro código."
            : "Não foi possível enviar o código. Entre novamente.",
        );
      else setSent(true);
    } catch {
      setError("Não foi possível conectar. Confira a internet e tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(candidate = code) {
    if (busy || candidate.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const result = await authClient.twoFactor.verifyOtp({ code: candidate });
      if (result.error) {
        setCode("");
        setError("Código inválido ou expirado. Confira o código ou peça outro.");
      }
      // With a session, the guard in _layout opens the tabs.
    } catch {
      setError("Não foi possível conectar. Confira a internet e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <View style={{ marginBottom: space.sm }}>
          <IconTile icon="lock.shield.fill" color="violet" size={56} />
        </View>
        <Text variant="largeTitle" accessibilityRole="header">
          Confirme seu acesso
        </Text>
        <Text tone="muted">
          {challenge
            ? `Sua conta pede uma segunda confirmação. O código vai para ${challenge.channel === "email" ? "o e-mail" : "o WhatsApp"} ${challenge.destination}.`
            : "Sua conta pede uma segunda confirmação."}
        </Text>
      </View>
      <View style={{ gap: space.form }}>
        {sent && (
          <CodeField
            value={code}
            onChange={(next) => {
              setCode(next);
              if (next.length === 6) void verify(next);
            }}
            invalid={!!error}
          />
        )}
        {error ? <Notice kind="error">{error}</Notice> : null}
        {challenge && (
          <Button
            title={sent ? "Confirmar" : "Enviar código"}
            icon={sent ? undefined : challenge.channel === "email" ? "envelope.fill" : "message.fill"}
            busy={busy}
            disabled={sent && code.length !== 6}
            onPress={() => void (sent ? verify() : send())}
          />
        )}
        <Button
          title="Voltar para a entrada"
          variant="plain"
          disabled={busy}
          onPress={() => {
            void authClient.$fetch("/security/cancel", { method: "POST", body: {} }).catch(() => undefined);
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}
