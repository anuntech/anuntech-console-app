import { useState } from "react";
import { View } from "react-native";
import { api, queryClient } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { useCooldown } from "@/lib/cooldown";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";
import { Button } from "./button";
import { CodeField } from "./field";
import { Notice } from "./surface";
import { Text } from "./text";
import { IconTile } from "./tile";
import { PasteCodeButton, SentTo } from "./code-tools";

const OFFLINE = "Não foi possível conectar. Confira a internet e tente novamente.";

/**
 * "Confirme que é você": changing the e-mail or WhatsApp needs a sign-in from
 * the last 10 minutes, and the app's session lasts 7 days. The person enters
 * again with a code on the current e-mail (the sign-in screen's calls); the
 * new session replaces the old one on this phone and me.get says so.
 */
export function RecentSignIn({ email, reason }: { email: string; reason: string }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seconds, startCooldown] = useCooldown();

  async function send() {
    if (busy || seconds > 0) return;
    setBusy(true);
    setError("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      if (result.error) {
        haptic.error();
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
      setError(OFFLINE);
    } finally {
      setBusy(false);
    }
  }

  async function verify(candidate = code) {
    if (busy || candidate.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.emailOtp({ email, otp: candidate });
      if (result.error || (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect)) {
        haptic.error();
        setCode("");
        setError("Código inválido ou expirado. Confira o código ou peça outro.");
        return;
      }
      // The screen behind this step reads recentSignIn from me.get.
      const me = await queryClient.fetchQuery({ queryKey: ["me"], queryFn: () => api.me.get({}), staleTime: 0 });
      if (!me.recentSignIn) {
        haptic.error();
        setError("Não foi possível validar sua sessão. Entre novamente e refaça a alteração.");
        return;
      }
      haptic.success();
    } catch {
      setError(OFFLINE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.form }}>
      <View style={{ gap: space.sm }}>
        <IconTile icon="lock.shield.fill" color="violet" size={48} />
        <Text variant="heading" accessibilityRole="header">
          Confirme que é você
        </Text>
        <Text tone="muted">
          {reason} Entre de novo com um código enviado para {email}.
        </Text>
      </View>
      {sent ? (
        <>
          <SentTo icon="envelope.fill" destination={email} />
          <CodeField
            testID="reauth-code"
            value={code}
            onChange={(next) => {
              setCode(next);
              if (next.length === 6) void verify(next);
            }}
            invalid={!!error}
          />
          {code.length < 6 ? (
            <PasteCodeButton
              disabled={busy}
              onError={setError}
              onCode={(pasted) => {
                setCode(pasted);
                void verify(pasted);
              }}
            />
          ) : null}
        </>
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <View style={{ gap: space.md }}>
        <Button
          title={busy ? "Aguarde…" : sent ? "Confirmar" : "Receber código"}
          icon={sent ? undefined : "envelope.fill"}
          testID={sent ? "reauth-confirm" : "reauth-send"}
          busy={busy}
          disabled={sent ? code.length !== 6 : seconds > 0}
          onPress={() => void (sent ? verify() : send())}
        />
        {sent ? (
          <Button
            title={seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
            variant="plain"
            disabled={busy || seconds > 0}
            onPress={() => void send()}
          />
        ) : null}
      </View>
    </View>
  );
}
