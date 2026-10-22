import { RefreshControl, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Card, Notice } from "@/components/surface";
import { Pill } from "@/components/pill";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { StatusTile } from "@/components/tile";
import { PdfRow } from "@/components/pdf-button";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
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
  const loading = useDelayed(quote.isPending);
  const q = quote.data;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={quote.isRefetching} onRefresh={() => void quote.refetch()} />}
    >
      {loading ? (
        <>
          <SkeletonHeader />
          <SkeletonRows count={2} inset={0} />
        </>
      ) : null}
      {quote.error ? <Notice kind="error">{errorMessage(quote.error)}</Notice> : null}
      {q ? (
        <>
          <View style={{ gap: space.sm }}>
            <Pill label={q.statusLabel} tone={quoteTone(q.status)} />
            <Text variant="title" accessibilityRole="header">
              {q.title}
            </Text>
            <Text variant="subhead" tone="muted">
              {q.number} · {q.company}
            </Text>
          </View>
          <View accessible accessibilityLabel={`Total, ${money(q.totalCents)}`} style={{ gap: 2 }}>
            <Text variant="caption" tone="muted">
              Total
            </Text>
            <Text variant="display">{money(q.totalCents)}</Text>
          </View>
          {q.hoursMax > 0 || q.validUntil ? (
            <Section indent={space.lg}>
              {q.hoursMax > 0 ? <ListRow title="Estimativa" value={hours(q.hoursMin, q.hoursMax)} /> : null}
              {q.validUntil ? <ListRow title="Válido até" value={civilDate(q.validUntil)} /> : null}
            </Section>
          ) : null}
          {q.decision ? (
            <Notice kind={q.status === "accepted" ? "success" : "info"} title={q.statusLabel}>
              {[
                `${q.decision.name} (${partyLabels[q.decision.party] ?? q.decision.party}) em ${when(q.decision.at)}`,
                q.decision.note,
              ]
                .filter(Boolean)
                .join("\n")}
            </Notice>
          ) : q.status === "sent" ? (
            // The answer asks for the full proposal on screen: it stays on the Console for now.
            <Card raised tone="warning">
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <StatusTile icon="text.bubble.fill" tone="attention" />
                <Text variant="subhead" style={{ flex: 1 }}>
                  Leia a proposta completa no PDF e responda no navegador.
                </Text>
              </View>
              <Button
                title="Responder no navegador"
                trailingIcon="arrow.up.right"
                accessibilityHint="Abre no navegador"
                onPress={() => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}/orcamentos/${q.id}`)}
              />
            </Card>
          ) : null}
          <Section>
            <PdfRow path={q.pdfPath} name={`Orçamento ${q.number}.pdf`} title="Ver proposta em PDF" icon="doc.richtext.fill" />
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}
