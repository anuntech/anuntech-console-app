import { ActivityIndicator, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Card, Notice, Row } from "@/components/surface";
import { Tag } from "@/components/record-card";
import { DocumentText } from "@/components/document-text";
import { PdfButton } from "@/components/pdf-button";
import { api, errorMessage } from "@/lib/api";
import { CONSOLE_URL } from "@/lib/config";
import { civilDate, when } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { space } from "@/lib/theme";
import { contractTone, partyLabels } from "@/lib/tones";

/** One contract: the text that went out, who signed and the PDF (contracts.get). */
export default function Contract() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useTabBarSpace();
  const contract = useQuery({ queryKey: ["contract", id], queryFn: () => api.contracts.get({ id }) });
  const c = contract.data;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.lg, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
    >
      {contract.isPending && <ActivityIndicator accessibilityLabel="Carregando" />}
      {contract.error && <Notice kind="error">{errorMessage(contract.error)}</Notice>}
      {c && (
        <>
          <View style={{ gap: space.sm }}>
            <Tag label={c.statusLabel} tone={contractTone(c.status)} />
            <Text variant="heading" accessibilityRole="header">
              {c.title}
            </Text>
            <Text variant="caption" tone="muted">
              {[c.kindLabel, c.company, c.engagement].filter(Boolean).join(" · ")}
            </Text>
            {c.startsAt ? (
              <Text variant="caption" tone="muted">
                Vigência {civilDate(c.startsAt)}
                {c.endsAt ? ` a ${civilDate(c.endsAt)}` : " por prazo indeterminado"}
              </Text>
            ) : null}
          </View>
          {c.status === "sent" ? (
            // Signing asks for the second step and the full text on screen: it stays on the Console for now.
            <Card>
              <Text variant="label">Aguardando assinatura</Text>
              <Text tone="muted">Leia o contrato e assine pelo Console no navegador.</Text>
              <Button
                title="Assinar no Console"
                onPress={() => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}/contratos/${c.id}`)}
              />
            </Card>
          ) : null}
          {c.signatures.length > 0 ? (
            <Card style={{ gap: 0 }}>
              <Text variant="label" style={{ marginBottom: space.xs }}>
                Assinaturas
              </Text>
              {c.signatures.map((s) => (
                <Row key={`${s.party}-${s.signedAt}`} title={s.name} detail={`${partyLabels[s.party] ?? s.party} · ${when(s.signedAt)}`} />
              ))}
            </Card>
          ) : null}
          <PdfButton path={c.pdfPath} name={`${c.title}.pdf`} />
          <DocumentText body={c.body} />
        </>
      )}
    </ScrollView>
  );
}
