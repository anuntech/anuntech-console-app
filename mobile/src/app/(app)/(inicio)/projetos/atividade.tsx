import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { fonts, space, usePalette } from "@/lib/theme";

type Event = Awaited<ReturnType<typeof api.projects.activity>>["events"][number];

const zone = "America/Sao_Paulo";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
const longDay = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" });

/** "Hoje", "Ontem" or "segunda-feira, 20 de outubro" (capitalized), in São Paulo's calendar. */
function dayLabel(iso: string, now = new Date()) {
  const day = dayKey.format(new Date(iso));
  if (day === dayKey.format(now)) return "Hoje";
  if (day === dayKey.format(new Date(now.getTime() - 86_400_000))) return "Ontem";
  const text = longDay.format(new Date(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * "Atividade do projeto" (projects.activity): who moved, approved, commented
 * or edited what, newest first and by day, with the web's filters. A task
 * still on the board opens from its row.
 */
export default function Activity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const activity = useQuery({ queryKey: ["project-activity", id], queryFn: () => api.projects.activity({ id }) });
  const loading = useDelayed(activity.isPending);
  const [filter, setFilter] = useState("all");
  const events = activity.data?.events ?? [];
  const shown = events.filter((event) => filter === "all" || event.kind === filter);
  const days: { label: string; rows: Event[] }[] = [];
  for (const event of shown) {
    const label = dayLabel(event.at);
    const last = days[days.length - 1];
    if (last?.label === label) last.rows.push(event);
    else days.push({ label, rows: [event] });
  }
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={activity.isRefetching} onRefresh={() => void activity.refetch()} />}
    >
      {activity.data ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
        >
          {activity.data.filters.map((option) => (
            <Chip key={option.key} label={option.label} group="Filtrar a atividade" selected={filter === option.key} onPress={() => setFilter(option.key)} />
          ))}
        </ScrollView>
      ) : null}
      {loading ? <SkeletonRows count={5} /> : null}
      {activity.error ? (
        <View style={{ paddingHorizontal: space.gutter }}>
          <Notice kind="error">{errorMessage(activity.error)}</Notice>
        </View>
      ) : null}
      {activity.data && days.length === 0 ? (
        <EmptyState
          icon="clock.arrow.circlepath"
          title={events.length ? "Nada deste tipo por aqui" : "Nada aconteceu ainda"}
          text={events.length ? "Escolha outro filtro para ver mais." : "O que acontecer no quadro aparece aqui: tarefas criadas, movidas, aprovadas e comentadas."}
        />
      ) : null}
      {days.map((day) => (
        <Section key={day.label} header={day.label} inset={space.gutter} indent={56}>
          {day.rows.map((event) => {
            const who = `${event.who.name}${event.who.staff ? " (Anuntech)" : ""}`;
            const task = event.task;
            return (
              <ListRow
                key={event.id}
                leading={<Avatar avatar={event.who.avatar} name={event.who.name} size={28} />}
                title={
                  <Text variant="subhead">
                    <Text variant="subhead" style={{ fontFamily: fonts.semibold }}>
                      {who}
                    </Text>{" "}
                    {event.text}
                  </Text>
                }
                meta={
                  task ? (
                    <Text variant="caption" tone={task.exists ? "primary" : "muted"} numberOfLines={1}>
                      {task.exists ? task.title : `${task.title} (excluída)`}
                    </Text>
                  ) : undefined
                }
                value={time.format(new Date(event.at))}
                accessibilityLabel={[`${who} ${event.text}`, task ? (task.exists ? task.title : `${task.title}, excluída`) : null, time.format(new Date(event.at))]
                  .filter(Boolean)
                  .join(", ")}
                accessibilityHint={task?.exists ? "Abre a tarefa" : undefined}
                trailing={task?.exists ? "chevron" : "none"}
                onPress={
                  task?.exists
                    ? () => {
                        haptic.light();
                        router.push({ pathname: "/projetos/tarefa/[id]", params: { id: task.id } });
                      }
                    : undefined
                }
              />
            );
          })}
        </Section>
      ))}
    </ScrollView>
  );
}
