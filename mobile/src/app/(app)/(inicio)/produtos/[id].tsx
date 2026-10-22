import { RefreshControl, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { ListRow } from "@/components/list-row";
import { Pill } from "@/components/pill";
import { ProductIcon } from "@/components/product-icon";
import { Section } from "@/components/section";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { Card, Notice } from "@/components/surface";
import { SuspensionCard } from "@/components/suspension-card";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { civilDate, money } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { engagementTone, intervalWords } from "@/lib/products";
import { space } from "@/lib/theme";

const SECTIONS = [
  ["whatWeDo", "O que fazemos"],
  ["whatWeNeed", "O que precisamos de você"],
  ["expectedResults", "Resultados esperados"],
  ["deadlines", "Prazos"],
] as const;

/**
 * A service (products.get): the catalog's four sections, its billing for
 * Administradores and "Abrir chamado" already about it. A product opened
 * here (suspended, or without a link yet) shows what it is, why it is
 * suspended and how to open it.
 */
export default function Product() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useTabBarSpace();
  const product = useQuery({ queryKey: ["product", id], queryFn: () => api.products.get({ id }) });
  const loading = useDelayed(product.isPending);
  const p = product.data;
  const filled = p ? SECTIONS.filter(([key]) => p.sections[key]) : [];
  const ticket = p ? { companyId: p.companyId, engagementId: p.id } : undefined;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={product.isRefetching} onRefresh={() => void product.refetch()} />}
    >
      {loading ? (
        <>
          <SkeletonHeader />
          <SkeletonRows count={2} inset={0} />
        </>
      ) : null}
      {product.error ? <Notice kind="error">{errorMessage(product.error)}</Notice> : null}
      {p ? (
        <>
          <View style={{ gap: space.sm }}>
            <ProductIcon path={p.iconPath} name={p.name} size={56} />
            {/* Active is the normal state: only an exception gets a pill. */}
            {p.status !== "active" ? <Pill label={p.statusLabel} tone={engagementTone(p.status)} /> : null}
            <Text variant="title" accessibilityRole="header">
              {p.name}
            </Text>
            <Text variant="subhead" tone="muted">
              {[p.kind === "service" ? "Serviço" : "Produto", p.showCompany ? p.company : null].filter(Boolean).join(" · ")}
            </Text>
            {p.description ? <Text variant="body">{p.description}</Text> : null}
          </View>
          {p.suspension ? <SuspensionCard notice={p.suspension} ticket={ticket} /> : null}
          {p.kind === "product" && p.status === "active" && p.opensAs !== "none" ? (
            <Button
              title="Abrir produto"
              icon={p.opensAs === "link" ? "arrow.up.right" : "macwindow"}
              accessibilityHint={p.opensAs === "link" ? "Abre no navegador" : undefined}
              onPress={() =>
                p.opensAs === "app"
                  ? router.push({ pathname: "/produtos/app/[id]", params: { id: p.id } })
                  : p.url
                    ? void WebBrowser.openBrowserAsync(p.url)
                    : undefined
              }
            />
          ) : null}
          {p.kind === "service" ? (
            filled.length ? (
              <Card>
                {filled.map(([key, title]) => (
                  <View key={key} style={{ gap: space.xs }}>
                    <Text variant="headline" accessibilityRole="header">
                      {title}
                    </Text>
                    <Text variant="body">{p.sections[key]}</Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Notice kind="info">Os detalhes deste serviço ainda não foram publicados.</Notice>
            )
          ) : null}
          {p.billing ? (
            <Section header="Cobrança" indent={16}>
              {p.billing.amountCents != null ? (
                <ListRow title="Valor" value={`${money(p.billing.amountCents)}${intervalWords(p.billing.interval)}`} valueTone="foreground" />
              ) : (
                <ListRow title="Sem cobrança vinculada." />
              )}
              {p.billing.nextDueDate ? <ListRow title="Próximo vencimento" value={civilDate(p.billing.nextDueDate)} valueTone="foreground" /> : null}
            </Section>
          ) : null}
          {p.kind === "service" ? (
            <Button
              title="Abrir chamado"
              icon="square.and.pencil"
              variant="secondary"
              onPress={() => router.push({ pathname: "/chamados/novo", params: { companyId: p.companyId, engagementId: p.id } })}
            />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
