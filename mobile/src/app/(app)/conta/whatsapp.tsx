import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { PasteCodeButton, SentTo } from "@/components/code-tools";
import { CodeField, Field } from "@/components/field";
import { RecentSignIn } from "@/components/recent-sign-in";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { errorMessage } from "@/lib/api";
import { authClient, normalizePhone } from "@/lib/auth";
import { formatPhone } from "@/lib/config";
import { useCooldown } from "@/lib/cooldown";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { space, usePalette } from "@/lib/theme";

const OFFLINE = "Não foi possível conectar. Confira a internet e tente novamente.";
const SESSION = "Não foi possível validar sua sessão. Entre novamente e refaça a alteração.";

/** A Brazilian number takes the (11) 99999-9999 mask; one starting with + stays as typed. */
function maskPhone(value: string) {
  const trimmed = value.trimStart();
  if (trimmed.startsWith("+")) return trimmed.slice(0, 25);
  const digits = trimmed.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  const split = digits.length > 10 ? 7 : 6;
  if (digits.length <= split) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

/**
 * Linking, replacing or removing the WhatsApp that signs in, straight on
 * Better Auth as the web does (send-otp with the "bind" purpose, then verify
 * with updatePhoneNumber). Needs the second step off and a recent sign-in.
 */
export default function Whatsapp() {
  const palette = usePalette();
  const queryClient = useQueryClient();
  const me = useMe();
  const bottom = useTabBarSpace();
  const loading = useDelayed(me.isPending);
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"code" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [seconds, startCooldown] = useCooldown();
  const current = me.data?.phone ?? null;
  const normalized = number.trim() ? normalizePhone(number) : "";
  const valid = /^\+[1-9]\d{9,14}$/.test(normalized);

  function fail(message: string) {
    haptic.error();
    setError(message);
  }
  /**
   * A 401 is a sign-in older than 10 minutes, not a dead session: when
   * me.get says so, the screen asks "Confirme que é você" again.
   */
  async function staleSignIn() {
    const fresh = await me.refetch();
    if (fresh.data && !fresh.data.recentSignIn) {
      haptic.error();
      setSent(false);
      setCode("");
      setError("");
    } else fail(SESSION);
  }

  async function act(action: "send" | "verify", candidate = code) {
    if (busy) return;
    if (action === "send" && seconds > 0) return;
    if (action === "verify" && candidate.length !== 6) return;
    if (!valid) return fail("Informe um telefone válido com DDD. Para outro país, use + e o DDI.");
    if (normalized === current) return fail("Este já é o seu WhatsApp.");
    setBusy("code");
    setError("");
    try {
      const result =
        action === "send"
          ? await authClient.phoneNumber.sendOtp(
              { phoneNumber: normalized },
              { headers: { "x-console-purpose": "bind" } },
            )
          : await authClient.phoneNumber.verify({
              phoneNumber: normalized,
              code: candidate,
              updatePhoneNumber: true,
              disableSession: true,
            });
      if (result.error) {
        if (result.error.status === 401) await staleSignIn();
        else if (result.error.status === 429) fail("Aguarde antes de pedir outro código.");
        else if (result.error.code === "PHONE_NUMBER_EXIST") {
          setSent(false);
          setCode("");
          fail("Este telefone já está vinculado a outra conta. Informe outro número.");
        } else if (result.error.status >= 500) fail("O envio ou a confirmação está indisponível. Aguarde e tente novamente.");
        else if (action === "verify") {
          setCode("");
          fail("Código inválido ou expirado. Confira o código ou peça outro.");
        } else fail("Não foi possível enviar o código. Confira o número.");
        return;
      }
      if (action === "send") {
        setSent(true);
        setCode("");
        startCooldown();
      } else {
        haptic.success();
        setDone("WhatsApp confirmado e atualizado.");
        setSent(false);
        setNumber("");
        setCode("");
        await queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    } catch {
      fail(OFFLINE);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setError("");
    try {
      const result = await authClient.updateUser({ phoneNumber: null });
      if (result.error) {
        if (result.error.status === 401) await staleSignIn();
        else fail("Não foi possível remover o telefone. Tente novamente.");
        return;
      }
      haptic.success();
      setDone("Telefone removido.");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      fail(OFFLINE);
    } finally {
      setBusy(null);
    }
  }

  function confirmRemoval() {
    Alert.alert("Remover o WhatsApp?", "O número deixa de servir para entrar. Você continua acessando por e-mail.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => void remove() },
    ]);
  }

  let body;
  if (!me.data) body = null;
  else if (done)
    body = (
      <>
        <Notice kind="success">{done}</Notice>
        <Button title="Voltar para Contatos de acesso" variant="secondary" testID="whatsapp-done" onPress={() => router.back()} />
      </>
    );
  else if (me.data.twoFactorEnabled)
    body = (
      <Notice kind="warning">
        Com a verificação em duas etapas ativa, e-mail e WhatsApp ficam protegidos. Desative em Segurança para alterá-los.
      </Notice>
    );
  else if (!me.data.recentSignIn)
    body = (
      <RecentSignIn
        email={me.data.email}
        reason={current ? "Para alterar ou remover o WhatsApp, confirme que é você." : "Para vincular o WhatsApp, confirme que é você."}
      />
    );
  else
    body = (
      <>
        {current ? (
          <View style={{ gap: 2 }}>
            <Text variant="caption" tone="muted">
              WhatsApp atual
            </Text>
            <Text variant="headline">{formatPhone(current)}</Text>
          </View>
        ) : null}
        <Text tone="muted">Um código de 6 números confirma que o número é seu. Ele vale por 5 minutos.</Text>
        {sent ? (
          <>
            <SentTo
              icon="message.fill"
              destination={number}
              disabled={!!busy}
              onChange={() => {
                setSent(false);
                setCode("");
                setError("");
              }}
            />
            <CodeField
              testID="whatsapp-code"
              label="Código de confirmação"
              value={code}
              onChange={(next) => {
                setCode(next);
                if (next.length === 6) void act("verify", next);
              }}
              invalid={!!error}
            />
            {code.length < 6 ? (
              <PasteCodeButton
                disabled={!!busy}
                onError={setError}
                onCode={(pasted) => {
                  setCode(pasted);
                  void act("verify", pasted);
                }}
              />
            ) : null}
          </>
        ) : (
          <Field
            label="Número com DDD"
            hint="Para outro país, comece com + e o DDI."
            testID="whatsapp-number"
            value={number}
            onChangeText={(next) => {
              setNumber(maskPhone(next));
              setError("");
            }}
            editable={!busy}
            autoFocus
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            maxLength={25}
            placeholder="(11) 99999-9999"
            returnKeyType="send"
            onSubmitEditing={() => void act("send")}
          />
        )}
        {error ? <Notice kind="error">{error}</Notice> : null}
        <View style={{ gap: space.md }}>
          <Button
            title={busy === "code" ? "Aguarde…" : sent ? "Confirmar" : "Receber código"}
            testID={sent ? "confirm-whatsapp" : "send-whatsapp-code"}
            busy={busy === "code"}
            disabled={!!busy || (sent ? code.length !== 6 : !valid || seconds > 0)}
            onPress={() => void act(sent ? "verify" : "send")}
          />
          {sent ? (
            <Button
              title={seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
              variant="plain"
              disabled={!!busy || seconds > 0}
              onPress={() => void act("send")}
            />
          ) : null}
        </View>
        {current && !sent ? (
          <Button
            title={busy === "remove" ? "Removendo…" : "Remover WhatsApp"}
            icon="trash"
            variant="plain"
            testID="remove-whatsapp"
            busy={busy === "remove"}
            disabled={!!busy}
            onPress={confirmRemoval}
          />
        ) : null}
      </>
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: current ? "Alterar WhatsApp" : "Vincular WhatsApp" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={{ padding: space.gutter, gap: space.form, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
      >
        {me.error ? <Notice kind="error">{errorMessage(me.error)}</Notice> : null}
        {loading ? <SkeletonRows count={2} inset={0} /> : null}
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
