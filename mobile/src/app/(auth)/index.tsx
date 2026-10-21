import { useEffect, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Image, KeyboardAvoidingView, Platform, Pressable, View, type TextInput } from "react-native";
import type { ComponentRef } from "react";
import { router } from "expo-router";
import { Screen, Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { CodeField, Field } from "@/components/field";
import { authClient, normalizePhone } from "@/lib/auth";
import { radius, space, usePalette } from "@/lib/theme";

type Mode = "email" | "whatsapp";

/**
 * Where the sign-in stopped, kept outside the screen: the person leaves for
 * WhatsApp or the e-mail to read the code and comes back to the same step.
 */
const draft: { mode: Mode; destination: string; sent: boolean; sentAt: number } = {
  mode: "email",
  destination: "",
  sent: false,
  sentAt: 0,
};
/** A code lives 5 minutes; after that the step starts over. */
const draftSent = () => draft.sent && Date.now() - draft.sentAt < 5 * 60_000;

/** One minute between code requests, as on the web. */
function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, () => setSeconds(60)] as const;
}

/**
 * Sign-in: e-mail or WhatsApp, then the 6-digit code. The same messages and
 * limits as the web (components/auth/login-form.tsx); no Google in the app.
 */
export default function SignIn() {
  const palette = usePalette();
  const destinationRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [mode, setMode] = useState<Mode>(draft.mode);
  const [destination, setDestination] = useState(draft.destination);
  const [sent, setSent] = useState(draftSent);
  useEffect(() => {
    Object.assign(draft, { mode, destination, sent });
  }, [mode, destination, sent]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [seconds, startCooldown] = useCooldown();

  const target = mode === "email" ? destination.trim().toLowerCase() : normalizePhone(destination);

  async function send() {
    if (busy || seconds > 0 || !destination.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result =
        mode === "email"
          ? await authClient.emailOtp.sendVerificationOtp({ email: target, type: "sign-in" })
          : await authClient.phoneNumber.sendOtp({ phoneNumber: target });
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Aguarde um minuto antes de pedir outro código."
            : "Não foi possível enviar. Confira os dados e tente novamente.",
        );
        return;
      }
      setMessage(
        `Se o acesso estiver autorizado, o código chega ${mode === "email" ? "no seu e-mail" : "no seu WhatsApp"} e vale por 5 minutos.`,
      );
      // Every new code restarts its 5 minutes, a resend included.
      draft.sentAt = Date.now();
      setSent(true);
      setCode("");
      startCooldown();
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
      const result =
        mode === "email"
          ? await authClient.signIn.emailOtp({ email: target, otp: candidate })
          : await authClient.phoneNumber.verify({ phoneNumber: target, code: candidate });
      if (result.error) {
        setError("Código inválido ou expirado. Confira o código ou peça outro.");
        setCode("");
        return;
      }
      if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        router.push("/segunda-etapa");
        return;
      }
      // Signed in: the next sign-in starts from the beginning. The guard in _layout opens the tabs.
      Object.assign(draft, { destination: "", sent: false, sentAt: 0 });
    } catch {
      setError("Não foi possível conectar. Confira a internet e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={{ gap: space.md, marginTop: space.block * 2 }}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={{ width: 56, height: 56, borderRadius: radius.lg }}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Text variant="caption" tone="muted">
            Boas-vindas
          </Text>
          <Text variant="title" accessibilityRole="header">
            Entre no Console
          </Text>
          <Text tone="muted">Use o e-mail liberado para a sua empresa ou o WhatsApp da sua conta.</Text>
        </View>

        {!sent && (
          <View
            accessibilityRole="tablist"
            style={{ flexDirection: "row", backgroundColor: palette.secondary, borderRadius: radius.lg, padding: 4 }}
          >
            {(["email", "whatsapp"] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === option }}
                disabled={busy}
                onPress={() => {
                  setMode(option);
                  setDestination("");
                  setError("");
                  setMessage("");
                }}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: radius.md,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: mode === option ? palette.card : "transparent",
                }}
              >
                <Text variant="label" tone={mode === option ? "foreground" : "muted"}>
                  {option === "email" ? "E-mail" : "WhatsApp"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ gap: space.form }}>
          {sent ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.secondary,
                paddingLeft: space.md,
              }}
            >
              <View style={{ flex: 1, paddingVertical: space.sm }}>
                <Text variant="caption" tone="muted">
                  Código enviado para
                </Text>
                <Text variant="label" numberOfLines={1}>
                  {destination}
                </Text>
              </View>
              <Button
                title="Alterar"
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  setSent(false);
                  setCode("");
                  setError("");
                  setMessage("");
                  setTimeout(() => destinationRef.current?.focus(), 50);
                }}
              />
            </View>
          ) : (
            <Field
              ref={destinationRef}
              key={mode}
              testID="destination"
              label={mode === "email" ? "Seu e-mail" : "Seu WhatsApp"}
              value={destination}
              onChangeText={setDestination}
              editable={!busy}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={mode === "email" ? "email-address" : "phone-pad"}
              textContentType={mode === "email" ? "emailAddress" : "telephoneNumber"}
              autoComplete={mode === "email" ? "email" : "tel"}
              placeholder={mode === "email" ? "voce@empresa.com.br" : "(11) 99999-9999"}
              hint={
                mode === "whatsapp"
                  ? "Use o número já vinculado em Minha conta, com DDD. Primeiro acesso? Entre por e-mail e vincule o WhatsApp depois."
                  : undefined
              }
              returnKeyType="send"
              onSubmitEditing={() => void send()}
            />
          )}
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
          {sent && code.length < 6 && (
            <Button
              title="Colar código"
              variant="outline"
              disabled={busy}
              onPress={async () => {
                // WhatsApp's "Copiar código" leaves the six numbers on the clipboard.
                const pasted = (await Clipboard.getStringAsync()).replace(/\D/g, "").slice(0, 6);
                if (pasted.length !== 6) {
                  setError("Copie o código de 6 números no WhatsApp ou no e-mail e toque em Colar código.");
                  return;
                }
                setCode(pasted);
                void verify(pasted);
              }}
            />
          )}
          {error ? <Notice kind="error">{error}</Notice> : null}
          {message ? <Notice kind="info">{message}</Notice> : null}
          <Button
            title={busy ? "Aguarde…" : sent ? "Entrar" : seconds ? `Aguarde ${seconds}s para pedir outro código` : "Receber código"}
            busy={busy}
            disabled={(!sent && (seconds > 0 || !destination.trim())) || (sent && code.length !== 6)}
            onPress={() => void (sent ? verify() : send())}
          />
          {sent && (
            <Button
              title={seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
              variant="ghost"
              disabled={busy || seconds > 0}
              onPress={() => void send()}
            />
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
