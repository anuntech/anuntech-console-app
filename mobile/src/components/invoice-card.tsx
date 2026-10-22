import { router } from "expo-router";
import { invoiceLook } from "@/lib/status";
import { fonts, usePalette } from "@/lib/theme";
import { dueLine } from "@/lib/format";
import { shownMoney, spokenMoney } from "@/lib/money-hidden";
import { ListRow } from "./list-row";
import { Text } from "./text";
import { StatusTile, toneColors } from "./tile";

export type InvoiceRow = {
  id: string;
  description: string;
  company: string;
  amountCents: number;
  display: "issued" | "overdue" | "paid" | "scheduled" | "draft" | "expired" | "cancelled";
  statusLabel: string;
  dueDate: string;
  /** The recurrence that issued it (Financeiro); a one-off charge says nothing. */
  interval?: "monthly" | "yearly" | null;
  /** Days past the due date while overdue (Financeiro). */
  daysOverdue?: number;
};

/** "1 dia de atraso", "5 dias de atraso", as the web says it. */
export const lateLabel = (days: number) => (days === 1 ? "1 dia de atraso" : `${days} dias de atraso`);
/** "Recorrência mensal" or "Recorrência anual". */
export const recurrenceLabel = (interval: "monthly" | "yearly") => `Recorrência ${interval === "yearly" ? "anual" : "mensal"}`;

/**
 * One invoice as a grouped-list row: status tile, description, the status and
 * due date under it, the amount at the end (red when overdue). Tapping opens it.
 * The caller draws the group (a Section, or `groupedItem` in a FlatList).
 */
export function InvoiceCard({ invoice, showCompany, hideMoney = false }: { invoice: InvoiceRow; showCompany?: boolean; /** The eye on Início is closed. */ hideMoney?: boolean }) {
  const palette = usePalette();
  const look = invoiceLook[invoice.display] ?? invoiceLook.issued;
  const overdue = invoice.display === "overdue";
  const late = overdue && invoice.daysOverdue ? lateLabel(invoice.daysOverdue) : null;
  const due = [dueLine(invoice.display, invoice.dueDate), late].filter(Boolean).join(" · ");
  const recurrence = invoice.interval ? recurrenceLabel(invoice.interval) : null;
  const meta = [showCompany ? invoice.company : null, recurrence].filter(Boolean).join(" · ");
  const amount = shownMoney(invoice.amountCents, hideMoney);
  return (
    <ListRow
      leading={<StatusTile icon={look.icon} tone={look.tone} />}
      title={
        <Text variant="headline" numberOfLines={2}>
          {invoice.description}
        </Text>
      }
      subtitle={
        <Text variant="subhead" tone={overdue ? "destructive" : "muted"} numberOfLines={2}>
          <Text variant="subhead" style={{ fontFamily: fonts.semibold, color: toneColors(palette, look.tone).fg }}>
            {invoice.statusLabel}
          </Text>
          {` · ${due}`}
        </Text>
      }
      meta={meta || undefined}
      value={amount}
      money
      valueTone={overdue ? "destructive" : "foreground"}
      accessibilityLabel={[invoice.statusLabel, invoice.description, spokenMoney(invoice.amountCents, hideMoney), due, invoice.company, recurrence].filter(Boolean).join(". ")}
      onPress={() => router.push({ pathname: "/financeiro/[id]", params: { id: invoice.id } })}
    />
  );
}
