import { useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Platform, ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Button } from "@/components/button";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { IconTile } from "@/components/tile";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { openAttachment } from "@/lib/files";
import { haptic } from "@/lib/haptics";
import { openHelp } from "@/lib/help-link";
import { useTabBarSpace } from "@/lib/layout";
import { mailKey, profileFileName, quotaLine } from "@/lib/mail";
import { rounded, space, usePalette } from "@/lib/theme";

/**
 * One mailbox, as the web's "Trocar senha" and "Configurar aparelhos": the
 * space used, a new password (a sheet) and what the mail apps ask for, with
 * the Apple profile on the iPhone. It reads the list's own query, so it
 * shows only a mailbox the person was given.
 */
export default function Mailbox() {
  const { company, id, domain } = useLocalSearchParams<{ company: string; id: string; domain?: string }>();
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const mail = useQuery({ queryKey: mailKey(company, domain), queryFn: () => api.mail.mailboxes({ companyId: company, domain }) });
  const loading = useDelayed(mail.isPending);
  const [downloading, setDownloading] = useState(false);
  const box = mail.data?.mailboxes.find((row) => row.id === id && row.managed);
  const setup = mail.data?.setup;
  const quota = box ? quotaLine(box.usedBytes, box.quotaBytes) : null;
  const copy = async (text: string, what: string) => {
    await Clipboard.setStringAsync(text);
    haptic.success();
    AccessibilityInfo.announceForAccessibility(`${what} copiado`);
  };
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
    >
      <Stack.Screen options={{ title: box?.address ?? "" }} />
      {loading ? <SkeletonRows count={4} inset={48} /> : null}
      {mail.error ? (
        <View style={{ gap: space.md }}>
          <Notice kind="error">{errorMessage(mail.error)}</Notice>
          <Button title="Tentar de novo" variant="secondary" onPress={() => void mail.refetch()} />
        </View>
      ) : null}
      {mail.data && !box ? <Notice kind="warning">Essa caixa não existe mais ou não está com você. Volte e atualize a lista.</Notice> : null}
      {box && quota && setup ? (
        <>
          <View style={{ gap: space.xs }}>
            <Text variant="heading" accessibilityRole="header">
              {box.address}
            </Text>
            {box.name ? <Text tone="muted">{box.name}</Text> : null}
          </View>
          <Section header="Espaço">
            <View style={{ padding: space.md, gap: space.sm }} accessible accessibilityLabel={`Espaço: ${quota.label}`}>
              <Text>{quota.label}</Text>
              {quota.percent !== null ? (
                <View style={{ height: 6, backgroundColor: palette.border, ...rounded(3), overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${quota.percent}%`,
                      height: 6,
                      backgroundColor: quota.percent >= 95 ? palette.destructive : quota.percent >= 80 ? palette.warning : palette.primary,
                    }}
                  />
                </View>
              ) : null}
            </View>
          </Section>
          <Section header="Senha" footer="Os aplicativos conectados com a senha antiga vão pedir a nova.">
            <ListRow
              leading={<IconTile icon="key.fill" color="amber" />}
              title="Trocar senha"
              trailing="chevron"
              onPress={() => router.push({ pathname: "/produtos/email/senha", params: { id: box.id, address: box.address } })}
            />
          </Section>
          <Section header="Configurar aparelhos" footer="Use a mesma senha da caixa na entrada e na saída. Toque para copiar.">
            <ListRow title="Usuário" value={box.address} onPress={() => void copy(box.address, "Usuário")} />
            <ListRow
              title="Entrada (IMAP)"
              value={`${setup.host} · ${setup.imapPort}`}
              subtitle="SSL/TLS"
              onPress={() => void copy(setup.host, "Servidor")}
            />
            <ListRow
              title="Saída (SMTP)"
              value={`${setup.host} · ${setup.smtpPort}`}
              subtitle={`SSL/TLS (ou ${setup.smtpStarttlsPort} com STARTTLS)`}
              onPress={() => void copy(setup.host, "Servidor")}
            />
          </Section>
          {Platform.OS === "ios" ? (
            <Section footer="Salve o perfil em Arquivos, abra o arquivo e instale em Ajustes › Perfil transferido. A senha é pedida na instalação: o arquivo não leva a senha.">
              <ListRow
                leading={<IconTile icon="iphone" color="ink" />}
                title={downloading ? "Baixando…" : "Baixar perfil para iPhone"}
                trailing={downloading ? <ActivityIndicator size="small" color={palette.muted} /> : "chevron"}
                onPress={async () => {
                  if (downloading) return;
                  setDownloading(true);
                  try {
                    await openAttachment(`/api/email/perfil/${encodeURIComponent(box.id)}`, profileFileName(box.address));
                  } catch {
                    Alert.alert("Não foi possível baixar o perfil", "Confira a internet e tente de novo.");
                  } finally {
                    setDownloading(false);
                  }
                }}
              />
            </Section>
          ) : null}
          <Section>
            <ListRow
              leading={<IconTile icon="questionmark.circle.fill" color="gray" />}
              title="Passo a passo de cada aplicativo"
              trailing="chevron"
              onPress={() => openHelp("configurar-email-nos-aparelhos")}
            />
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}
