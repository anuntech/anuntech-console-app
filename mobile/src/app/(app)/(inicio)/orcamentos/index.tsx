import { router } from "expo-router";
import { PagedList } from "@/components/paged-list";
import { RecordRow } from "@/components/record-card";
import { api } from "@/lib/api";
import { civilDate, money } from "@/lib/format";
import { quoteTone } from "@/lib/tones";

/** The company's quotes, with the figures that were sent (quotes.list). */
export default function Quotes() {
  return (
    <PagedList
      queryKey={["quotes"]}
      load={(page) => api.quotes.list({ page })}
      empty={{
        icon: "list.bullet.rectangle",
        title: "Nenhum orçamento ainda",
        text: "Propostas enviadas para sua empresa aparecem aqui para você responder.",
      }}
      render={(q, showCompany) => (
        <RecordRow
          kind="quote"
          title={q.title}
          status={{ label: q.statusLabel, tone: quoteTone(q.status) }}
          value={money(q.totalCents)}
          details={[q.number, showCompany ? q.company : null, q.validUntil ? `Válido até ${civilDate(q.validUntil)}` : null]
            .filter(Boolean)
            .join(" · ")}
          onPress={() => router.push({ pathname: "/orcamentos/[id]", params: { id: q.id } })}
        />
      )}
    />
  );
}
