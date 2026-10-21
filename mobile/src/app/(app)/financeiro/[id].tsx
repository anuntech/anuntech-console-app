import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Card, Notice } from "@/components/surface";
import { InvoiceBadge } from "@/components/invoice-badge";
import { api, errorMessage } from "@/lib/api";
import { CONSOLE_URL } from "@/lib/config";
import { openAttachment } from "@/lib/files";
import { dueLine, money } from "@/lib/format";
import { space } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

/** One invoice and what pays it: Pix copia e cola, the boleto and the payment page. */
export default function Invoice() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useTabBarSpace();
  const invoice = useQuery({ queryKey: ["invoice", id], queryFn: () => api.finance.get({ id }) });
  const [copied, setCopied] = useState<"pix" | "line" | null>(null);
  const copy = async (what: "pix" | "line", text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2500);
  };
  const i = invoice.data;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}>
      {invoice.isPending && <ActivityIndicator accessibilityLabel="Carregando" />}
      {invoice.error && <Notice kind="error">{errorMessage(invoice.error)}</Notice>}
      {i && (
        <>
          <View style={{ gap: space.sm }}>
            <InvoiceBadge display={i.display} label={i.statusLabel} />
            <Text variant="title" style={{ fontVariant: ["tabular-nums"] }}>
              {money(i.amountCents)}
            </Text>
            <Text variant="label" style={{ fontSize: 16 }}>
              {i.description}
            </Text>
            <Text variant="caption" tone="muted">
              {[i.company, i.engagement, dueLine(i.display, i.dueDate)].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {i.pix ? (
            <Card>
              <Text variant="heading">Pix copia e cola</Text>
              <Text variant="caption" tone="muted" numberOfLines={3} selectable>
                {i.pix}
              </Text>
              <Button
                title={copied === "pix" ? "Código copiado" : "Copiar código Pix"}
                testID="copy-pix"
                onPress={() => void copy("pix", i.pix!)}
              />
              <Text variant="caption" tone="muted">
                Cole no app do seu banco, na opção Pix copia e cola.
              </Text>
            </Card>
          ) : null}
          {i.boletoLine ? (
            <Card>
              <Text variant="heading">Boleto</Text>
              <Text selectable style={{ fontVariant: ["tabular-nums"] }}>
                {i.boletoLine}
              </Text>
              <Button
                title={copied === "line" ? "Linha copiada" : "Copiar linha digitável"}
                variant="outline"
                onPress={() => void copy("line", i.boletoLine!)}
              />
              {i.boletoPath ? (
                <Button
                  title="Baixar boleto em PDF"
                  variant="outline"
                  onPress={() =>
                    void openAttachment(i.boletoPath!, "boleto.pdf").catch(() =>
                      Alert.alert("Não foi possível abrir o boleto", "Confira a internet e tente de novo."),
                    )
                  }
                />
              ) : null}
            </Card>
          ) : null}
          {i.payPath ? (
            <Button
              title="Abrir a página de pagamento"
              variant="ghost"
              onPress={() => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}${i.payPath}`)}
            />
          ) : null}
          {i.display === "paid" ? <Notice kind="info">Pagamento confirmado pelo banco.</Notice> : null}
        </>
      )}
    </ScrollView>
  );
}
