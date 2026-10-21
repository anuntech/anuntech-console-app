import { router } from "expo-router";
import { View } from "react-native";
import { PagedList } from "@/components/paged-list";
import { RecordCard, Tag } from "@/components/record-card";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { when } from "@/lib/format";
import { radius, usePalette } from "@/lib/theme";

/** A thin bar with the share of the board already done. */
function Progress({ done, total }: { done: number; total: number }) {
  const palette = usePalette();
  const share = total ? done / total : 0;
  return (
    <View accessibilityLabel={`${done} de ${total} tarefas concluídas`} style={{ gap: 4 }}>
      <View style={{ height: 6, borderRadius: radius.sm, backgroundColor: palette.secondary, overflow: "hidden" }}>
        <View style={{ width: `${Math.round(share * 100)}%`, height: 6, backgroundColor: palette.primary }} />
      </View>
      <Text variant="caption" tone="muted">
        {total ? `${done} de ${total} tarefas concluídas` : "Sem tarefas ainda"}
      </Text>
    </View>
  );
}

/** The projects the person sees (projects.list). */
export default function Projects() {
  return (
    <PagedList
      queryKey={["projects"]}
      load={(page) => api.projects.list({ page })}
      empty="Nenhum projeto por aqui."
      render={(p, showCompany) => (
        <RecordCard
          title={p.name}
          tag={<Tag label={p.statusLabel} tone="info" />}
          details={[showCompany ? p.company : null, `Atualizado em ${when(p.updatedAt)}`].filter(Boolean).join(" · ")}
          onPress={() => router.push({ pathname: "/projetos/[id]", params: { id: p.id } })}
        >
          <Progress done={p.tasks.done} total={p.tasks.total} />
        </RecordCard>
      )}
    />
  );
}
