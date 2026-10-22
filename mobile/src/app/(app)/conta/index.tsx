import { useEffect, useState } from "react";
import { Alert, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Notice } from "@/components/surface";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { useMe } from "@/lib/me";
import { errorMessage } from "@/lib/api";
import { CONSOLE_URL, formatPhone, imageUrl } from "@/lib/config";
import { haptic } from "@/lib/haptics";
import { confirmIdentity, lockAvailable, lockEnabled, setLockEnabled } from "@/lib/lock";
import { signOut } from "@/lib/session";
import { useTabBarSpace } from "@/lib/layout";
import { space, usePalette } from "@/lib/theme";

const roles = { manager: "Administrador", member: "Membro" } as const;

/** First letters of the first and last names, for the avatar without a photo. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** The account: profile, the Face ID lock, sign out and account deletion. */
export default function Account() {
  const palette = usePalette();
  const me = useMe();
  const bottom = useTabBarSpace();
  const [canLock, setCanLock] = useState(false);
  const [locked, setLocked] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    void lockAvailable().then(setCanLock);
    void lockEnabled().then(setLocked);
  }, []);
  const avatar = imageUrl(me.data?.image);
  const companies = me.data?.companies ?? [];
  const where = me.data?.staff
    ? "Equipe da Anuntech"
    : companies.length === 1
      ? `${roles[companies[0].role]} · ${companies[0].name}`
      : companies.length > 1
        ? `${companies.length} empresas`
        : null;
  const phone = me.data?.phone ? `WhatsApp ${formatPhone(me.data.phone)}` : null;

  async function toggleLock(next: boolean) {
    if (next && !(await confirmIdentity("Ativar o Face ID no Console"))) return;
    await setLockEnabled(next);
    setLocked(next);
    if (next) haptic.success();
  }
  function leave() {
    Alert.alert("Sair do Console?", undefined, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          setLeaving(true);
          void signOut().finally(() => setLeaving(false));
        },
      },
    ]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      style={{ backgroundColor: palette.background }}
    >
      {me.error && <Notice kind="error">{errorMessage(me.error)}</Notice>}
      {me.data && (
        <Section>
          <View
            accessible
            accessibilityLabel={[me.data.name, me.data.email, phone, where].filter(Boolean).join(", ")}
            style={{ flexDirection: "row", alignItems: "center", padding: space.lg, gap: 14 }}
          >
            {avatar ? (
              <Image
                source={{ uri: avatar }}
                accessible={false}
                contentFit="cover"
                style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: palette.secondary }}
              />
            ) : (
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: palette.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="heading" tone="primary" maxFontSizeMultiplier={1.2}>
                  {initials(me.data.name)}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{me.data.name}</Text>
              <Text variant="subhead" tone="muted">
                {me.data.email}
              </Text>
              {phone ? (
                <Text variant="subhead" tone="muted">
                  {phone}
                </Text>
              ) : null}
              {where ? (
                <Text variant="caption" tone="muted">
                  {where}
                </Text>
              ) : null}
            </View>
          </View>
        </Section>
      )}
      <Section footer="Nome, foto, e-mail e WhatsApp ficam em Minha conta, no navegador.">
        <ListRow
          title="Editar perfil"
          leading={<IconTile icon="person.text.rectangle.fill" color="violet" />}
          trailing="external"
          onPress={() => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}/conta`)}
        />
      </Section>
      {canLock && (
        <Section footer="Pede o Face ID ao abrir o app e depois de 5 minutos fora dele.">
          <View
            accessible
            accessibilityRole="switch"
            accessibilityLabel="Travar com Face ID"
            accessibilityState={{ checked: locked }}
            onAccessibilityTap={() => void toggleLock(!locked)}
          >
            <ListRow
              title="Travar com Face ID"
              leading={<IconTile icon="faceid" color="green" />}
              trailing={
                <Switch
                  value={locked}
                  trackColor={{ true: palette.primary }}
                  onValueChange={(next) => void toggleLock(next)}
                />
              }
            />
          </View>
        </Section>
      )}
      <Section>
        <ListRow
          title={leaving ? "Saindo…" : "Sair"}
          leading={<IconTile icon="rectangle.portrait.and.arrow.right" color="gray" />}
          trailing="none"
          onPress={leaving ? undefined : leave}
        />
      </Section>
      <Section footer="Apaga seus dados pessoais. Chamados e faturas ficam com a empresa.">
        <ListRow
          title="Excluir minha conta"
          tone="destructive"
          leading={<IconTile icon="trash.fill" color="red" />}
          onPress={() => {
            if (me.data?.owner)
              Alert.alert(
                "Não é possível excluir",
                "A conta do proprietário do Console não pode ser excluída. Transfira a administração antes.",
              );
            else router.push("/conta/excluir");
          }}
        />
      </Section>
      <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
        Console da Anuntech · versão {Constants.expoConfig?.version}
      </Text>
    </ScrollView>
  );
}
