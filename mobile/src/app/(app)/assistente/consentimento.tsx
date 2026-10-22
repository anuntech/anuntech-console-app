import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { setAssistantConsent, settleConsent } from "@/lib/consent";
import { usePalette } from "@/lib/theme";

/**
 * Asked once, before the first message to the assistant: what it uses and
 * what it reads. "Agora não" keeps the message unsent.
 */
export default function AssistantConsent() {
  const palette = usePalette();
  const [saving, setSaving] = useState(false);
  // Swiping the sheet away counts as "Agora não".
  useEffect(() => () => settleConsent(false), []);
  const accept = async () => {
    setSaving(true);
    try {
      await setAssistantConsent(true);
    } finally {
      setSaving(false);
    }
    router.back();
  };
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, gap: 12, alignItems: "center" }}>
      <SymbolView name="sparkles" size={40} tintColor={palette.primary} accessible={false} />
      <Text variant="heading" accessibilityRole="header" style={{ textAlign: "center" }}>
        Antes de começar
      </Text>
      <Text variant="subhead" tone="muted" style={{ textAlign: "center", maxWidth: 340 }}>
        O assistente usa um modelo de IA de terceiros, pelo AI Gateway da Vercel, para responder. Ele lê seus chamados,
        faturas, projetos e contratos com o seu acesso. Nada muda sem você confirmar.
      </Text>
      <View style={{ alignSelf: "stretch", gap: 4, marginTop: 12 }}>
        <Button title={saving ? "Salvando…" : "Continuar"} busy={saving} onPress={() => void accept()} />
        <Button
          title="Agora não"
          variant="plain"
          disabled={saving}
          onPress={() => {
            settleConsent(false);
            router.back();
          }}
        />
      </View>
    </View>
  );
}
