import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "@/components/symbol";
import * as WebBrowser from "expo-web-browser";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { space, usePalette } from "@/lib/theme";

/**
 * A product's protected app (CMS, Roteiro Digital, Base Pendente), as the
 * web's /apps/[id]: apps.open checks everything and signs a 2-minute pass,
 * and the app opens it in the in-app browser (the web uses an iframe). When
 * the product does not open, the screen says why and what to do. "Abrir de
 * novo" asks for a fresh pass, like the web's Recarregar.
 */
export default function ProductApp() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const [opened, setOpened] = useState<string | null>(null);
  const open = useMutation({
    mutationFn: () => api.apps.open({ id }),
    onSuccess: async (result) => {
      if (result.kind === "page") {
        router.replace(result.to === "project" ? { pathname: "/projetos/[id]", params: { id: result.id } } : { pathname: "/produtos/[id]", params: { id: result.id } });
        return;
      }
      if (result.kind === "blocked") {
        haptic.error();
        return;
      }
      setOpened(result.app);
      await WebBrowser.openBrowserAsync(result.url).catch(() => undefined);
    },
    onError: () => haptic.error(),
  });
  // The pass is asked for once the screen is up, never kept: each opening gets a new one.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    open.mutate();
  }, [open]);
  const blocked = open.data?.kind === "blocked" ? open.data : null;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
    >
      <Stack.Screen options={{ title: blocked?.product ?? opened ?? "" }} />
      {open.isPending ? (
        <View accessible accessibilityLabel="Abrindo o app" style={{ alignItems: "center", gap: space.md, paddingTop: space.xxl }}>
          <SymbolView name="macwindow" size={44} tintColor={palette.primary} accessible={false} />
          <Text variant="subhead" tone="muted">
            Abrindo o app…
          </Text>
        </View>
      ) : null}
      {open.error ? (
        <View style={{ gap: space.md }}>
          <Notice kind="error">{errorMessage(open.error)}</Notice>
          <Button title="Tentar de novo" variant="secondary" onPress={() => open.mutate()} />
        </View>
      ) : null}
      {blocked ? (
        <View style={{ alignItems: "center", gap: space.md, paddingTop: space.xl }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
            <SymbolView name="shippingbox" size={28} tintColor={palette.primary} accessible={false} />
          </View>
          <Text variant="caption" tone="muted">
            {blocked.product}
          </Text>
          <Text variant="heading" accessibilityRole="header" style={{ textAlign: "center" }}>
            {blocked.title}
          </Text>
          <Text variant="subhead" tone="muted" style={{ textAlign: "center", maxWidth: 320 }}>
            {blocked.description}
          </Text>
          <View style={{ alignSelf: "stretch", gap: space.sm, marginTop: space.sm }}>
            {blocked.link ? (
              <Button
                title="Abrir produto"
                icon="arrow.up.right"
                accessibilityHint="Abre no navegador"
                onPress={() => void WebBrowser.openBrowserAsync(blocked.link!)}
              />
            ) : null}
            {blocked.pay ? (
              <Button title="Pagar agora" icon="creditcard.fill" onPress={() => router.push({ pathname: "/financeiro", params: { status: "overdue" } })} />
            ) : null}
            {blocked.ticket || blocked.pay ? (
              <Button title="Abrir chamado" variant="secondary" icon="square.and.pencil" onPress={() => router.push("/chamados/novo")} />
            ) : null}
            <Button title="Ver produtos e serviços" variant="plain" onPress={() => router.push("/produtos")} />
          </View>
        </View>
      ) : null}
      {opened && !open.isPending ? (
        <View style={{ alignItems: "center", gap: space.md, paddingTop: space.xl }}>
          <SymbolView name="macwindow" size={44} tintColor={palette.primary} accessible={false} />
          <Text variant="heading" accessibilityRole="header" style={{ textAlign: "center" }}>
            {opened}
          </Text>
          <Text variant="subhead" tone="muted" style={{ textAlign: "center", maxWidth: 320 }}>
            O app abre no navegador com o seu acesso ao Console. O link vale por 2 minutos; para entrar de novo, peça outro.
          </Text>
          <Button title="Abrir de novo" icon="arrow.clockwise" variant="secondary" onPress={() => open.mutate()} />
        </View>
      ) : null}
    </ScrollView>
  );
}
