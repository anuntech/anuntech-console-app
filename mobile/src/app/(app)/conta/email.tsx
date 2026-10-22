import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { ORPCError } from "@orpc/client";
import { Button } from "@/components/button";
import { CodeField, Field } from "@/components/field";
import { RecentSignIn } from "@/components/recent-sign-in";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { useCooldown } from "@/lib/cooldown";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { signOut } from "@/lib/session";
import { space, usePalette } from "@/lib/theme";

type Challenge = { challengeId: string; email: string };

/**
 * Moving the main e-mail (Minha conta → "Alterar e-mail de acesso"): a code
 * to the current address and one to the new. Once confirmed every session
 * ends, this one included, and the person enters again with the new address.
 */
export default function ChangeEmail() {
  const palette = usePalette();
  const me = useMe();
  const bottom = useTabBarSpace();
  const loading = useDelayed(me.isPending);
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [sourceCode, setSourceCode] = useState("");
  const [targetCode, setTargetCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seconds, startCooldown] = useCooldown();

  /**
   * A refusal. A 401 ("Entre novamente para alterar os dados de acesso…") is
   * a sign-in older than 10 minutes, not a dead session: me.get then says
   * recentSignIn false and the screen asks "Confirme que é você" again.
   */
  async function fail(failure: unknown) {
    haptic.error();
    if (failure instanceof ORPCError && failure.status === 401) {
      const fresh = await me.refetch();
      if (fresh.data && !fresh.data.recentSignIn) {
        setError("");
        return;
      }
    }
    setError(errorMessage(failure));
  }

  async function request() {
    if (busy || seconds > 0) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.profile.startEmailChange({ email: (challenge?.email ?? email).trim() });
      setChallenge({ challengeId: result.challengeId, email: result.email });
      setSourceCode("");
      setTargetCode("");
      startCooldown();
    } catch (failure) {
      await fail(failure);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(source = sourceCode, target = targetCode) {
    if (!challenge || busy || source.length !== 6 || target.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.profile.confirmEmailChange({
        challengeId: challenge.challengeId,
        sourceCode: source,
        targetCode: target,
      });
      haptic.success();
      // Every session ended on the server: sign out here and open the sign-in with the new address.
      await signOut({ message: result.message, email: challenge.email });
    } catch (failure) {
      await fail(failure);
      setBusy(false);
    }
  }

  let body;
  if (!me.data) body = null;
  else if (me.data.twoFactorEnabled)
    body = (
      <Notice kind="warning">
        Com a verificação em duas etapas ativa, e-mail e WhatsApp ficam protegidos. Desative em Segurança para alterá-los.
      </Notice>
    );
  else if (!me.data.recentSignIn)
    body = <RecentSignIn email={me.data.email} reason="Para alterar o e-mail de acesso, confirme que é você." />;
  else if (!challenge)
    body = (
      <>
        <Text tone="muted">
          Você recebe um código no e-mail atual e outro no novo. Depois de confirmar, entra novamente com o novo endereço.
        </Text>
        <Field
          label="Novo e-mail"
          testID="new-email"
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            setError("");
          }}
          editable={!busy}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          maxLength={254}
          placeholder="voce@empresa.com.br"
          returnKeyType="send"
          onSubmitEditing={() => void request()}
        />
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Button
          title={busy ? "Enviando códigos…" : seconds ? `Aguarde ${seconds}s para pedir outros códigos` : "Enviar códigos"}
          testID="send-codes"
          busy={busy}
          disabled={!email.trim() || seconds > 0}
          onPress={() => void request()}
        />
      </>
    );
  else
    body = (
      <>
        <View style={{ gap: space.xs }}>
          <Text variant="heading" accessibilityRole="header">
            Confirme os dois códigos
          </Text>
          <Text tone="muted">Cada endereço recebeu um código de 6 números. Eles valem por 5 minutos.</Text>
        </View>
        <CodeField
          testID="source-code"
          label={`Código enviado para ${me.data.email}`}
          value={sourceCode}
          onChange={setSourceCode}
          invalid={!!error}
        />
        <CodeField
          testID="target-code"
          label={`Código enviado para ${challenge.email}`}
          value={targetCode}
          onChange={(next) => {
            setTargetCode(next);
            if (next.length === 6 && sourceCode.length === 6) void confirm(sourceCode, next);
          }}
          invalid={!!error}
          autoFocus={false}
        />
        {error ? <Notice kind="error">{error}</Notice> : null}
        <View style={{ gap: space.md }}>
          <Button
            title={busy ? "Confirmando…" : "Confirmar e-mail"}
            testID="confirm-email"
            busy={busy}
            disabled={sourceCode.length !== 6 || targetCode.length !== 6}
            onPress={() => void confirm()}
          />
          <Button
            title={seconds ? `Reenviar em ${seconds}s` : "Reenviar códigos"}
            variant="plain"
            disabled={busy || seconds > 0}
            onPress={() => void request()}
          />
          <Button
            title="Usar outro e-mail"
            variant="plain"
            disabled={busy}
            onPress={() => {
              setChallenge(null);
              setError("");
            }}
          />
        </View>
      </>
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
