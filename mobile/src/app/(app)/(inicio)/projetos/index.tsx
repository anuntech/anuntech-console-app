import { router } from "expo-router";
import { View } from "react-native";
import { PagedList } from "@/components/paged-list";
import { RecordRow } from "@/components/record-card";
import { api } from "@/lib/api";
import { when } from "@/lib/format";
import { rounded, usePalette } from "@/lib/theme";

/** A thin bar with the share of the board already done (the row says it in words). */
function Progress({ done, total }: { done: number; total: number }) {
  const palette = usePalette();
  const share = total ? done / total : 0;
  return (
    <View style={{ height: 6, ...rounded(999), backgroundColor: palette.fill, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(share * 100)}%`, height: 6, backgroundColor: palette.success }} />
    </View>
  );
}

/** The projects the person sees (projects.list). */
export default function Projects() {
  return (
    <PagedList
      queryKey={["projects"]}
      load={(page) => api.projects.list({ page })}
      empty={{
        icon: "square.grid.2x2",
        title: "Nenhum projeto ainda",
        text: "Quando a Anuntech começar um projeto com sua empresa, o quadro aparece aqui.",
      }}
      render={(p, showCompany) => (
        <RecordRow
          kind="project"
          title={p.name}
          status={{ label: p.statusLabel, tone: "info" }}
          details={[showCompany ? p.company : null, `Atualizado em ${when(p.updatedAt)}`].filter(Boolean).join(" · ")}
          note={p.tasks.total ? `${p.tasks.done} de ${p.tasks.total} tarefas concluídas` : "Sem tarefas ainda"}
          onPress={() => router.push({ pathname: "/projetos/[id]", params: { id: p.id } })}
        >
          {p.tasks.total ? <Progress done={p.tasks.done} total={p.tasks.total} /> : null}
        </RecordRow>
      )}
    />
  );
}
