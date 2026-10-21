import { useEffect, useState } from "react";
import { Alert, ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { Card, Notice, Row } from "@/components/surface";
import { Text } from "@/components/text";
import { useMe } from "@/lib/me";
import { errorMessage } from "@/lib/api";
import { CONSOLE_URL, formatPhone, imageUrl } from "@/lib/config";
import {
  confirmIdentity,
  lockAvailable,
  lockEnabled,
  setLockEnabled,
} from "@/lib/lock";
import { signOut } from "@/lib/session";
import { radius, space, usePalette } from "@/lib/theme";

/** The account: profile, the Face ID lock, sign out and account deletion. */
export default function Account() {
  const palette = usePalette();
  const me = useMe();
  const [canLock, setCanLock] = useState(false);
  const [locked, setLocked] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    void lockAvailable().then(setCanLock);
    void lockEnabled().then(setLocked);
  }, []);
  const avatar = imageUrl(me.data?.image);
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.block }}
      >
        <Text
          variant="title"
          accessibilityRole="header"
          style={{ marginTop: space.lg }}
        >
          Conta
        </Text>
        {me.error && <Notice kind="error">{errorMessage(me.error)}</Notice>}
        {me.data && (
          <Card
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.lg,
            }}
          >
            {avatar ? (
              <Image
                source={{ uri: avatar }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: palette.secondary,
                }}
                accessibilityLabel="Sua foto"
              />
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{me.data.name}</Text>
              <Text variant="caption" tone="muted">
                {me.data.email}
              </Text>
              {me.data.phone ? (
                <Text variant="caption" tone="muted">
                  WhatsApp {formatPhone(me.data.phone)}
                </Text>
              ) : null}
            </View>
          </Card>
        )}
        <Card style={{ gap: 0 }}>
          <Row
            title="Editar perfil no navegador"
            detail="Nome, foto, e-mail e WhatsApp ficam em Minha conta."
            onPress={() =>
              void WebBrowser.openBrowserAsync(`${CONSOLE_URL}/conta`)
            }
          />
          {canLock && (
            <Row
              title="Travar com Face ID"
              detail="Pede o Face ID ao abrir o app e depois de 5 minutos fora dele."
              accessory={
                <Switch
                  value={locked}
                  accessibilityLabel="Travar com Face ID"
                  onValueChange={async (next) => {
                    if (
                      next &&
                      !(await confirmIdentity("Ativar o Face ID no Console"))
                    )
                      return;
                    await setLockEnabled(next);
                    setLocked(next);
                  }}
                />
              }
            />
          )}
        </Card>
        <Card style={{ gap: 0, borderRadius: radius.xl }}>
          <Row
            title={leaving ? "Saindo…" : "Sair"}
            onPress={
              leaving
                ? undefined
                : () => {
                    setLeaving(true);
                    void signOut().finally(() => setLeaving(false));
                  }
            }
          />
          <Row
            title="Excluir minha conta"
            tone="destructive"
            onPress={() => {
              if (me.data?.owner)
                Alert.alert(
                  "Não é possível excluir",
                  "A conta do proprietário do Console não pode ser excluída. Transfira a administração antes.",
                );
              else router.push("/conta/excluir");
            }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
