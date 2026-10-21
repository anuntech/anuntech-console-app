import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { radius, space, usePalette } from "@/lib/theme";
import { dueLine, money } from "@/lib/format";
import { Text } from "./text";
import { InvoiceBadge } from "./invoice-badge";

export type InvoiceRow = {
  id: string;
  description: string;
  company: string;
  amountCents: number;
  display: "issued" | "overdue" | "paid" | "scheduled" | "draft" | "expired" | "cancelled";
  statusLabel: string;
  dueDate: string;
};

/** One invoice in a list; tapping opens it. */
export function InvoiceCard({ invoice, showCompany }: { invoice: InvoiceRow; showCompany?: boolean }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${invoice.description}, ${money(invoice.amountCents)}, ${invoice.statusLabel}`}
      onPress={() => router.push({ pathname: "/financeiro/[id]", params: { id: invoice.id } })}
      style={({ pressed }) => ({
        backgroundColor: palette.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.lg,
        gap: space.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm }}>
        <InvoiceBadge display={invoice.display} label={invoice.statusLabel} />
        <Text variant="label" style={{ fontVariant: ["tabular-nums"] }}>
          {money(invoice.amountCents)}
        </Text>
      </View>
      <Text variant="label" numberOfLines={2} style={{ fontSize: 16, lineHeight: 22 }}>
        {invoice.description}
      </Text>
      <Text variant="caption" tone="muted">
        {[showCompany ? invoice.company : null, dueLine(invoice.display, invoice.dueDate)].filter(Boolean).join(" · ")}
      </Text>
    </Pressable>
  );
}
