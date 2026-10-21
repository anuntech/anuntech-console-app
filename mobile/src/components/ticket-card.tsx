import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { when } from "@/lib/format";
import { radius, space, usePalette } from "@/lib/theme";
import { Text } from "./text";
import { StatusBadge } from "./badge";

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

/** One ticket in a list; tapping opens the conversation. */
export function TicketCard({ ticket, showCompany }: { ticket: TicketRow; showCompany?: boolean }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ticket.subject}, ${ticket.statusLabel}`}
      onPress={() => router.push({ pathname: "/chamados/[id]", params: { id: ticket.id } })}
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
      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center", flexWrap: "wrap" }}>
        <StatusBadge status={ticket.status} label={ticket.statusLabel} />
        {ticket.kindLabel ? (
          <Text variant="caption" tone="muted">
            {ticket.kindLabel}
          </Text>
        ) : null}
      </View>
      <Text variant="label" numberOfLines={2} style={{ fontSize: 16, lineHeight: 22 }}>
        {ticket.subject}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {[showCompany ? ticket.company : null, ticket.engagement, when(ticket.updatedAt)].filter(Boolean).join(" · ")}
      </Text>
      {ticket.due ? (
        <Text variant="caption" tone={ticket.due.late ? "destructive" : "muted"}>
          {ticket.due.label}
        </Text>
      ) : null}
    </Pressable>
  );
}
