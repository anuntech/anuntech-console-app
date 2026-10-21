import { ActivityIndicator, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Card, Notice, Row } from "@/components/surface";
import { Tag } from "@/components/record-card";
import { PdfButton } from "@/components/pdf-button";
import { api, errorMessage } from "@/lib/api";
import { CONSOLE_URL } from "@/lib/config";
import { civilDate, money, when } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { space } from "@/lib/theme";
import { partyLabels, quoteTone } from "@/lib/tones";

const hours = (min: number, max: number) => (min === max ? `${min} h` : `${min} a ${max} h`);

/** One quote: the figures, the answer if there is one, and the PDF with the phases (quotes.get). */
export default function Quote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useTabBarSpace();
  const quote = useQuery({ queryKey: ["quote", id], queryFn: () => api.quotes.get({ id }) });
  const q = quote.data;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.lg, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
    >
      {quote.isPending && <ActivityIndicator accessibilityLabel="Carregando" />}
      {quote.error && <Notice kind="error">{errorMessage(quote.error)}</Notice>}
      {q && (
        <>
          <View style={{ gap: space.sm }}>
            <Tag label={q.statusLabel} tone={quoteTone(q.status)} />
            <Text variant="heading" accessibilityRole="header">
              {q.title}
            </Text>
            <Text variant="caption" tone="muted">
              {q.number} · {q.company}
            </Text>
          </View>
          <Card style={{ gap: 0 }}>
            <Row title="Total" accessory={<Text variant="label">{money(q.totalCents)}</Text>} />
            {q.hoursMax > 0 ? <Row title="Estimativa" accessory={<Text>{hours(q.hoursMin, q.hoursMax)}</Text>} /> : null}
            {q.validUntil ? <Row title="Válido até" accessory={<Text>{civilDate(q.validUntil)}</Text>} /> : null}
          </Card>
          {q.decision ? (
            <Card>
              <Text variant="label">{q.statusLabel}</Text>
              <Text tone="muted">
                {q.decision.name} ({partyLabels[q.decision.party] ?? q.decision.party}) em {when(q.decision.at)}
              </Text>
              {q.decision.note ? <Text>{q.decision.note}</Text> : null}
            </Card>
          ) : q.status === "sent" ? (
            // The answer asks for the full proposal on screen: it stays on the Console for now.
            <Card>
              <Text variant="label">Aguardando sua resposta</Text>
              <Text tone="muted">Leia a proposta completa no PDF e responda pelo Console no navegador.</Text>
              <Button
                title="Responder no Console"
                onPress={() => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}/orcamentos/${q.id}`)}
              />
            </Card>
          ) : null}
          <PdfButton path={q.pdfPath} name={`Orçamento ${q.number}.pdf`} title="Ver proposta em PDF" />
        </>
      )}
    </ScrollView>
  );
}
