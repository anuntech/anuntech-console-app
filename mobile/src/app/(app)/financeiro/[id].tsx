import { useEffect, useState } from "react";
import { AccessibilityInfo, Alert, Platform, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { Bar, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { IconTile, StatusTile, toneColors } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { CONSOLE_URL } from "@/lib/config";
import { openAttachment } from "@/lib/files";
import { civilDate, dueLine, money } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { invoiceLook } from "@/lib/status";
import { rounded, space, usePalette } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

const mono = Platform.select({ ios: "Menlo", default: "monospace" });

/** The hero's shape while the invoice loads. */
function HeroSkeleton() {
  return (
    <View accessible accessibilityLabel="Carregando" style={{ alignItems: "center", gap: 10, paddingTop: space.sm }}>
      <Bar width={56} height={56} radius={28} />
      <Bar width="55%" height={40} />
      <Bar width="70%" height={17} />
      <Bar width="40%" height={15} />
    </View>
  );
}

/** One invoice and what pays it: Pix copia e cola, the boleto and the payment page. */
export default function Invoice() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const invoice = useQuery({ queryKey: ["invoice", id], queryFn: () => api.finance.get({ id }) });
  const loading = useDelayed(invoice.isPending);
  const [copied, setCopied] = useState<"pix" | "line" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async (what: "pix" | "line", text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(what);
    haptic.success();
    AccessibilityInfo.announceForAccessibility(what === "pix" ? "Código Pix copiado" : "Linha digitável copiada");
  };
  const i = invoice.data;
  const look = i ? (invoiceLook[i.display] ?? invoiceLook.issued) : null;
  const paid = i?.display === "paid";
  const overdue = i?.display === "overdue";
  const status = !i
    ? ""
    : paid
      ? "Pagamento confirmado pelo banco"
      : i.display === "issued" || overdue
        ? dueLine(i.display, i.dueDate)
        : `${i.statusLabel} · ${dueLine(i.display, i.dueDate)}`;

  const details = i ? (
    <Section key="details" indent={space.lg}>
      <ListRow title="Empresa" value={i.company} />
      {i.engagement ? <ListRow title="Serviço" value={i.engagement} /> : null}
      <ListRow title="Vencimento" value={civilDate(i.dueDate)} />
    </Section>
  ) : null;
  const payPage = i?.payPath ? (
    <Section key="pay">
      <ListRow
        title="Abrir a página de pagamento"
        leading={<IconTile icon="safari.fill" color="violet" />}
        trailing="external"
        onPress={() => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}${i.payPath}`)}
      />
    </Section>
  ) : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      style={{ backgroundColor: palette.background }}
    >
      {loading && <HeroSkeleton />}
      {invoice.error && <Notice kind="error">{errorMessage(invoice.error)}</Notice>}
      {i && look && (
        <>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={[i.statusLabel, money(i.amountCents), i.description, status].join(". ")}
            style={{ alignItems: "center", gap: space.sm, paddingTop: space.sm }}
          >
            <StatusTile icon={look.icon} tone={look.tone} size={56} />
            <Text variant="display" style={{ textAlign: "center" }}>
              {money(i.amountCents)}
            </Text>
            <Text variant="headline" style={{ textAlign: "center" }}>
              {i.description}
            </Text>
            <Text variant="label" style={{ textAlign: "center", color: toneColors(palette, look.tone).fg }}>
              {status}
            </Text>
          </View>
          {overdue ? <Notice kind="error">Esta fatura está vencida. O Pix compensa na hora.</Notice> : null}
          {!paid && i.pix ? (
            <Section header="Pix copia e cola" footer="Cole no app do seu banco, na opção Pix copia e cola.">
              <View style={{ padding: space.lg, gap: space.md }}>
                <View style={{ backgroundColor: palette.fill, ...rounded(12), padding: space.md }}>
                  <Text
                    variant="caption"
                    selectable
                    numberOfLines={2}
                    ellipsizeMode="middle"
                    style={{ fontFamily: mono, fontSize: 13, lineHeight: 18 }}
                  >
                    {i.pix}
                  </Text>
                </View>
                <Button
                  title={copied === "pix" ? "Código copiado" : "Copiar código Pix"}
                  icon={copied === "pix" ? "checkmark" : "doc.on.doc"}
                  testID="copy-pix"
                  onPress={() => void copy("pix", i.pix!)}
                />
              </View>
            </Section>
          ) : null}
          {!paid && i.boletoLine ? (
            <Section header="Boleto">
              <View style={{ padding: space.lg }}>
                <Text
                  selectable
                  accessibilityLabel={`Linha digitável: ${i.boletoLine}`}
                  style={{ fontFamily: mono, fontSize: 15, lineHeight: 22, fontVariant: ["tabular-nums"] }}
                >
                  {i.boletoLine}
                </Text>
              </View>
              <ListRow
                title={copied === "line" ? "Linha copiada" : "Copiar linha digitável"}
                leading={<IconTile icon={copied === "line" ? "checkmark" : "doc.on.doc"} color="gray" />}
                tone="primary"
                trailing="none"
                onPress={() => void copy("line", i.boletoLine!)}
              />
              {i.boletoPath ? (
                <ListRow
                  title="Baixar boleto em PDF"
                  leading={<IconTile icon="arrow.down.doc.fill" color="gray" />}
                  onPress={() =>
                    void openAttachment(i.boletoPath!, "boleto.pdf").catch(() =>
                      Alert.alert("Não foi possível abrir o boleto", "Confira a internet e tente de novo."),
                    )
                  }
                />
              ) : null}
            </Section>
          ) : null}
          {details}
          {payPage}
        </>
      )}
    </ScrollView>
  );
}
