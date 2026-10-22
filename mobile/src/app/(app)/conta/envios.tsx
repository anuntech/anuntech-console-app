import { View } from "react-native";
import { router } from "expo-router";
import { ListRow } from "@/components/list-row";
import { ManagerGate } from "@/components/manager-gate";
import { PagedList } from "@/components/paged-list";
import { Pill } from "@/components/pill";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api } from "@/lib/api";
import { when } from "@/lib/format";
import { noticeHistoryKey } from "@/lib/manager";
import { space } from "@/lib/theme";

type Notice = Awaited<ReturnType<typeof api.notifications.history>>["rows"][number];

/**
 * Configurações → Notificações → Histórico de envios on the web: every
 * notice that went out for the company, by e-mail or WhatsApp, newest first.
 */
export default function NoticeHistory() {
  return (
    <ManagerGate>
      <PagedList
        queryKey={[...noticeHistoryKey]}
        load={(page) => api.notifications.history({ page })}
        header={
          <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.xs }}>
            Os avisos de chamados e do financeiro que saíram por e-mail e WhatsApp.
          </Text>
        }
        empty={{ icon: "bell.slash", title: "Nenhum aviso registrado", text: "Os próximos envios aparecem aqui." }}
        render={(notice) => <NoticeRow notice={notice} />}
      />
    </ManagerGate>
  );
}

function NoticeRow({ notice }: { notice: Notice }) {
  const email = notice.channel === "email";
  const open = () =>
    notice.kind === "ticket"
      ? router.push({ pathname: "/chamados/[id]", params: { id: notice.recordId } })
      : router.push({ pathname: "/financeiro/[id]", params: { id: notice.recordId } });
  const date = when(notice.createdAt);
  return (
    <ListRow
      testID={`notice-${notice.id}`}
      leading={<IconTile icon={email ? "envelope.fill" : "message.fill"} color={email ? "violet" : "green"} />}
      title={
        <Text variant="headline" numberOfLines={2}>
          {notice.subject}
        </Text>
      }
      subtitle={`${notice.actionLabel} · ${notice.recipient}`}
      meta={
        <View style={{ marginTop: 6, gap: 6 }}>
          <Pill label={notice.statusLabel} tone={notice.tone} />
          {notice.error ? (
            <Text variant="caption" tone="muted">
              {notice.error}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            {date}
          </Text>
        </View>
      }
      accessibilityLabel={[
        notice.subject,
        notice.actionLabel,
        `${email ? "E-mail" : "WhatsApp"} para ${notice.recipient}`,
        notice.statusLabel,
        notice.error,
        date,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint={notice.kind === "ticket" ? "Abre o chamado" : "Abre a fatura"}
      onPress={open}
    />
  );
}
