import { ActivityIndicator, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Card, Notice } from "@/components/surface";
import { Tag } from "@/components/record-card";
import { api, errorMessage } from "@/lib/api";
import { civilDate, when } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { space } from "@/lib/theme";

/** One project's board, column by column (projects.get). Empty columns stay out. */
export default function Project() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useTabBarSpace();
  const project = useQuery({ queryKey: ["project", id], queryFn: () => api.projects.get({ id }) });
  const p = project.data;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.lg, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
    >
      <Stack.Screen options={{ title: "Projeto" }} />
      {project.isPending && <ActivityIndicator accessibilityLabel="Carregando" />}
      {project.error && <Notice kind="error">{errorMessage(project.error)}</Notice>}
      {p && (
        <>
          <View style={{ gap: space.sm }}>
            <Tag label={p.statusLabel} tone="info" />
            <Text variant="heading" accessibilityRole="header">
              {p.name}
            </Text>
            <Text variant="caption" tone="muted">
              {p.company}
            </Text>
            {p.description ? <Text tone="muted">{p.description}</Text> : null}
          </View>
          {p.columns
            .filter((column) => column.tasks.length > 0)
            .map((column) => (
              <View key={column.status} style={{ gap: space.md }}>
                <Text variant="heading">
                  {column.label} · {column.tasks.length}
                </Text>
                {column.tasks.map((task) => (
                  <Card key={task.id} style={{ gap: space.xs }}>
                    <Text variant="label" style={{ fontSize: 16, lineHeight: 22 }}>
                      {task.title}
                    </Text>
                    {task.description ? (
                      <Text variant="caption" tone="muted" numberOfLines={3}>
                        {task.description}
                      </Text>
                    ) : null}
                    {(() => {
                      const line = [
                        task.assignees.length ? task.assignees.join(", ") : null,
                        task.dueDate ? `Prazo ${civilDate(task.dueDate)}` : null,
                        task.comments ? `${task.comments} comentário${task.comments > 1 ? "s" : ""}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return line ? (
                        <Text variant="caption" tone="muted">
                          {line}
                        </Text>
                      ) : null;
                    })()}
                    {task.reviewDue ? (
                      <Text variant="caption" tone="primary">
                        Aguardando sua revisão até {when(task.reviewDue)}
                      </Text>
                    ) : null}
                  </Card>
                ))}
              </View>
            ))}
          {p.columns.every((column) => column.tasks.length === 0) ? (
            <Text tone="muted">Nenhuma tarefa no quadro ainda.</Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
