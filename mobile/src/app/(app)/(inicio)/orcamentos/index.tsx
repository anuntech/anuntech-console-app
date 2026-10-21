import { router } from "expo-router";
import { PagedList } from "@/components/paged-list";
import { RecordCard, Tag } from "@/components/record-card";
import { api } from "@/lib/api";
import { civilDate, money } from "@/lib/format";
import { quoteTone } from "@/lib/tones";

/** The company's quotes, with the figures that were sent (quotes.list). */
export default function Quotes() {
  return (
    <PagedList
      queryKey={["quotes"]}
      load={(page) => api.quotes.list({ page })}
      empty="Nenhum orçamento por aqui."
      render={(q, showCompany) => (
        <RecordCard
          title={q.title}
          tag={<Tag label={q.statusLabel} tone={quoteTone(q.status)} />}
          corner={money(q.totalCents)}
          details={[q.number, showCompany ? q.company : null, q.validUntil ? `Válido até ${civilDate(q.validUntil)}` : null]
            .filter(Boolean)
            .join(" · ")}
          onPress={() => router.push({ pathname: "/orcamentos/[id]", params: { id: q.id } })}
        />
      )}
    />
  );
}
