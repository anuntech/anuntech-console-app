import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { CodeField, Field } from "@/components/field";
import { api, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/me";
import { forgetSession } from "@/lib/session";
import { space } from "@/lib/theme";

const WORD = "EXCLUIR";

/**
 * Account deletion, as in Minha conta on the web: a fresh code, the typed
 * word, then the person is signed out. Required by the App Store (5.1.1(v)).
 */
export default function DeleteAccount() {
  const me = useMe();
  const [challenge, setChallenge] = useState<{ challengeId: string; destination: string } | null>(null);
  const [code, setCode] = useState("");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function request(channel: "email" | "whatsapp") {
    setBusy(true);
    setError("");
    try {
      setChallenge(await api.account.requestDeletion({ channel }));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      await api.account.delete({ challengeId: challenge.challengeId, code, confirmation: word });
      await forgetSession();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space.lg, gap: space.form }}
    >
      {!challenge ? (
        <>
          <Text>Para confirmar que é você, enviamos um código novo.</Text>
          <View style={{ gap: space.sm }}>
            <Text>
              <Text variant="label">Apagamos</Text> seu nome, e-mails, telefone, foto, sessões, conversas com o
              assistente e as pastas de bookmarks que só você via.
            </Text>
            <Text>
              <Text variant="label">Ficam com a empresa</Text>, com o autor &quot;Conta excluída&quot;: chamados e
              mensagens, assinaturas de contrato, horas e faturas.
            </Text>
            <Text>Você perde o acesso a todas as empresas. Para voltar, alguém precisa convidar você de novo.</Text>
          </View>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Button title="Código no e-mail" busy={busy} onPress={() => void request("email")} />
          {me.data?.phone ? (
            <Button
              title="Código no WhatsApp"
              variant="outline"
              disabled={busy}
              onPress={() => void request("whatsapp")}
            />
          ) : null}
        </>
      ) : (
        <>
          <Text tone="muted">
            Código enviado para {challenge.destination}. Ele vale por 5 minutos e aceita 3 tentativas.
          </Text>
          <CodeField value={code} onChange={setCode} label="Código" />
          <Field
            label={`Digite ${WORD} para confirmar`}
            value={word}
            onChangeText={setWord}
            testID="confirmation"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={40}
          />
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Button
            title={busy ? "Excluindo…" : "Excluir conta"}
            testID="delete-account"
            variant="destructive"
            busy={busy}
            disabled={code.length !== 6 || word.trim().toUpperCase() !== WORD}
            onPress={() => void confirm()}
          />
        </>
      )}
    </ScrollView>
  );
}
