import { View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { when } from "@/lib/format";
import { ticketLook } from "@/lib/status";
import { usePalette } from "@/lib/theme";
import { ListRow } from "./list-row";
import { Text } from "./text";
import { StatusTile, toneColors } from "./tile";

export type TicketRow = {
  id: string;
  subject: string;
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  statusLabel: string;
  kindLabel: string | null;
  company: string;
  engagement: string | null;
  updatedAt: string;
  due: { label: string; late: boolean } | null;
};

/**
 * One ticket in a grouped list (Mail style): the status as a round tile and in
 * words, the subject, then where it is and when it moved. Tapping opens the
 * conversation. The parent draws the white group around it.
 */
export function TicketCard({ ticket, showCompany }: { ticket: TicketRow; showCompany?: boolean }) {
  const palette = usePalette();
  const look = ticketLook[ticket.status] ?? ticketLook.open;
  const color = toneColors(palette, look.tone).fg;
  const place = [showCompany ? ticket.company : null, ticket.engagement].filter(Boolean).join(" · ");
  const late = !!ticket.due?.late;
  // Meta line: place and time, then the deadline (an on-time one joins the line;
  // a late one gets its own icon and words and is never cut off).
  const base = [place, when(ticket.updatedAt), late ? null : ticket.due?.label].filter(Boolean).join(" · ");
  const label = [
    ticket.statusLabel,
    ticket.subject,
    ticket.kindLabel,
    place,
    when(ticket.updatedAt),
    ticket.due ? `${late ? "Atrasado: " : ""}${ticket.due.label}` : null,
  ]
    .filter(Boolean)
    .join(". ");
  return (
    <ListRow
      leading={<StatusTile icon={look.icon} tone={look.tone} />}
      title={ticket.subject}
      titleStyle="semibold"
      subtitle={
        <Text variant="subhead" tone="muted" numberOfLines={1}>
          <Text variant="label" style={{ color }}>
            {ticket.statusLabel}
          </Text>
          {ticket.kindLabel ? ` · ${ticket.kindLabel}` : ""}
        </Text>
      }
      meta={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {base}
            {late ? " ·" : ""}
          </Text>
          {late && ticket.due ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0 }}>
              <SymbolView name="exclamationmark.circle.fill" size={13} tintColor={palette.destructive} accessible={false} />
              <Text variant="caption" tone="destructive" numberOfLines={1}>
                Atrasado: {ticket.due.label}
              </Text>
            </View>
          ) : null}
        </View>
      }
      accessibilityLabel={label}
      accessibilityHint="Abre a conversa"
      onPress={() => router.push({ pathname: "/chamados/[id]", params: { id: ticket.id } })}
    />
  );
}
