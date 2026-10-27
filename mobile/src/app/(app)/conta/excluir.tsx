import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { Card, Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { CodeField, Field } from "@/components/field";
import { api, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/me";
import { forgetSession } from "@/lib/session";
import { space, usePalette } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

const WORD = "EXCLUIR";

/** One line of what happens, with its symbol. */
function Point({ icon, children }: { icon: SFSymbol; children: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      <SymbolView name={icon} size={18} tintColor={palette.muted} accessible={false} style={{ marginTop: 1 }} />
      <Text variant="subhead" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Account deletion, as in Minha conta on the web: a fresh code, the typed
 * word, then the person is signed out. Required by the App Store (5.1.1(v)).
 */
export default function DeleteAccount() {
  const palette = usePalette();
  const me = useMe();
  const bottom = useTabBarSpace();
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
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{ padding: space.gutter, gap: space.form, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
    >
      {!challenge ? (
        <>
          <Text>Para confirmar que é você, enviamos um código novo.</Text>
          <Card>
            <Point icon="trash">
              <Text variant="label">Apagamos</Text> seu nome, e-mails, telefone, foto, sessões, conversas com o
              assistente e as pastas de Arquivos que só você via.
            </Point>
            <Point icon="building.2">
              <Text variant="label">Ficam com a empresa</Text>, com o autor &quot;Conta excluída&quot;: chamados e
              mensagens, assinaturas de contrato, horas e faturas.
            </Point>
            <Point icon="person.crop.circle.badge.xmark">
              Você perde o acesso a todas as empresas. Para voltar, alguém precisa convidar você de novo.
            </Point>
          </Card>
          {error ? <Notice kind="error">{error}</Notice> : null}
          <View style={{ gap: space.md }}>
            <Button
              title="Código no e-mail"
              icon="envelope.fill"
              busy={busy}
              onPress={() => void request("email")}
            />
            {me.data?.phone ? (
              <Button
                title="Código no WhatsApp"
                icon="message.fill"
                variant="secondary"
                disabled={busy}
                onPress={() => void request("whatsapp")}
              />
            ) : null}
          </View>
        </>
      ) : (
        <>
          <Text variant="subhead" tone="muted">
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
            icon="trash.fill"
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
