import { router } from "expo-router";
import { PagedList } from "@/components/paged-list";
import { RecordCard, Tag } from "@/components/record-card";
import { api } from "@/lib/api";
import { when } from "@/lib/format";
import { contractTone } from "@/lib/tones";

/** The company's contracts that went out (contracts.list). */
export default function Contracts() {
  return (
    <PagedList
      queryKey={["contracts"]}
      load={(page) => api.contracts.list({ page })}
      empty="Nenhum contrato por aqui."
      render={(c, showCompany) => (
        <RecordCard
          title={c.title}
          tag={<Tag label={c.statusLabel} tone={contractTone(c.status)} />}
          details={[c.kindLabel, showCompany ? c.company : null, `Atualizado em ${when(c.updatedAt)}`]
            .filter(Boolean)
            .join(" · ")}
          onPress={() => router.push({ pathname: "/contratos/[id]", params: { id: c.id } })}
        />
      )}
    />
  );
}
