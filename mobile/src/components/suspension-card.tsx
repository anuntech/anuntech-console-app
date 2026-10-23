import { View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "@/components/symbol";
import { rounded, space, usePalette } from "@/lib/theme";
import { Button } from "./button";
import { Text } from "./text";

/**
 * What the client reads while a product is suspended (the web's
 * SuspendedNotice): why, that nothing was deleted, and the two ways out.
 * "Pagar agora" opens the overdue invoices (Administradores, late payment);
 * "Falar com a equipe" opens a ticket, about the product when there is one.
 */
export function SuspensionCard({
  notice,
  ticket,
}: {
  notice: { title: string; text: string; canPay: boolean };
  ticket?: { companyId: string; engagementId: string };
}) {
  const palette = usePalette();
  return (
    <View
      style={{
        gap: space.md,
        padding: 14,
        ...rounded(16),
        borderWidth: 1,
        borderColor: palette.destructiveEdge,
        backgroundColor: palette.destructiveSoft,
      }}
    >
      <View accessible accessibilityRole="alert" style={{ flexDirection: "row", gap: 10 }}>
        <SymbolView name="nosign" size={18} tintColor={palette.destructive} accessible={false} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" tone="destructive">
            {notice.title}
          </Text>
          <Text variant="subhead">{notice.text}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {notice.canPay ? (
          <Button
            title="Pagar agora"
            icon="creditcard.fill"
            size="small"
            onPress={() => router.push({ pathname: "/financeiro", params: { status: "overdue" } })}
          />
        ) : null}
        <Button
          title="Falar com a equipe"
          icon="bubble.left.and.bubble.right.fill"
          size="small"
          variant="secondary"
          onPress={() => router.push(ticket ? { pathname: "/chamados/novo", params: ticket } : "/chamados/novo")}
        />
      </View>
    </View>
  );
}
