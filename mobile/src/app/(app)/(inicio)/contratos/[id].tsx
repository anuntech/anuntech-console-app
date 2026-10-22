import { RefreshControl, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SymbolView } from "expo-symbols";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Card, Notice } from "@/components/surface";
import { Pill } from "@/components/pill";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { StatusTile } from "@/components/tile";
import { DocumentText } from "@/components/document-text";
import { PdfRow } from "@/components/pdf-button";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { api, errorMessage } from "@/lib/api";
import { CONSOLE_URL } from "@/lib/config";
import { civilDate, when } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { space, usePalette } from "@/lib/theme";
import { contractTone, partyLabels } from "@/lib/tones";

/** One contract: the text that went out, who signed and the PDF (contracts.get). */
export default function Contract() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const contract = useQuery({ queryKey: ["contract", id], queryFn: () => api.contracts.get({ id }) });
  const loading = useDelayed(contract.isPending);
  const c = contract.data;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={contract.isRefetching} onRefresh={() => void contract.refetch()} />}
    >
      {loading ? (
        <>
          <SkeletonHeader />
          <SkeletonRows count={2} inset={0} />
        </>
      ) : null}
      {contract.error ? <Notice kind="error">{errorMessage(contract.error)}</Notice> : null}
      {c ? (
        <>
          <View style={{ gap: space.sm }}>
            <Pill label={c.statusLabel} tone={contractTone(c.status)} />
            <Text variant="title" accessibilityRole="header">
              {c.title}
            </Text>
            <Text variant="subhead" tone="muted">
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
            <Card raised tone="warning">
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <StatusTile icon="signature" tone="attention" />
                <Text variant="subhead" style={{ flex: 1 }}>
                  Leia o contrato e assine no navegador.
                </Text>
              </View>
              <Button
                title="Assinar no navegador"
                trailingIcon="arrow.up.right"
                accessibilityHint="Abre no navegador"
                onPress={() => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}/contratos/${c.id}`)}
              />
            </Card>
          ) : null}
          {c.signatures.length > 0 ? (
            <Section header="Assinaturas" indent={52}>
              {c.signatures.map((s) => (
                <ListRow
                  key={`${s.party}-${s.signedAt}`}
                  leading={
                    <SymbolView
                      name="checkmark.seal.fill"
                      size={20}
                      tintColor={palette.success}
                      accessible={false}
                      style={{ width: 24, height: 24 }}
                    />
                  }
                  title={s.name}
                  subtitle={`${partyLabels[s.party] ?? s.party} · ${when(s.signedAt)}`}
                />
              ))}
            </Section>
          ) : null}
          <Section>
            <PdfRow path={c.pdfPath} name={`${c.title}.pdf`} />
          </Section>
          <Section header="Contrato">
            <DocumentText body={c.body} style={{ padding: 20 }} />
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}
