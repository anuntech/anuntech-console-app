import { useDeferredValue, useRef, useState } from "react";
import { Stack, router } from "expo-router";
import type { SearchBarCommands } from "react-native-screens";
import { FilterChips } from "@/components/filter-chips";
import { PagedList } from "@/components/paged-list";
import { RecordRow } from "@/components/record-card";
import { api } from "@/lib/api";
import { civilDate } from "@/lib/format";
import { contractTone } from "@/lib/tones";

type Status = "all" | "sent" | "in_review" | "signed";
type Row = Awaited<ReturnType<typeof api.contracts.list>>["rows"][number];

/** The web's situation filter for clients (contract-table's clientContractFilters). */
const filters: { value: Status; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "sent", label: "Aguardando assinatura" },
  { value: "in_review", label: "Em revisão" },
  { value: "signed", label: "Assinados" },
];

/** The web's Vigência column: the dates, and how near the end a signed contract is. */
function termLine(row: Row) {
  if (row.endsAt) return `${row.startsAt ? `${civilDate(row.startsAt)} – ` : "até "}${civilDate(row.endsAt)}`;
  if (row.startsAt) return `a partir de ${civilDate(row.startsAt)}`;
  return null;
}

/** The company's contracts that went out, by situation and with a search (contracts.list). */
export default function Contracts() {
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const searchBar = useRef<SearchBarCommands>(null);
  // As the web's "Limpar filtros": the situation and the search both go.
  const clear = () => {
    searchBar.current?.clearText();
    setSearch("");
    setStatus("all");
  };
  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            ref: searchBar,
            placeholder: "Buscar por título",
            hideWhenScrolling: false,
            onChangeText: (e) => setSearch(e.nativeEvent.text),
          },
        }}
      />
      <PagedList
        queryKey={["contracts", status, query]}
        load={(page) => api.contracts.list({ page, status, search: query })}
        header={<FilterChips options={filters} value={status} onChange={setStatus} group="Situação" />}
        empty={{
          icon: "doc.text",
          title: "Nenhum contrato ainda",
          text: "Os contratos da sua empresa com a Anuntech aparecem aqui para leitura e assinatura.",
        }}
        filtered={
          status !== "all" || query
            ? {
                icon: "magnifyingglass",
                title: "Nenhum contrato encontrado",
                text: "Tente outro termo ou mude os filtros.",
                action: { label: "Limpar filtros", onPress: clear },
              }
            : undefined
        }
        render={(c, showCompany) => {
          // Clients have no signatures column on the web: the row says whose signature is missing.
          const missing = c.status === "sent" ? (c.signedBy.includes("client") ? "Falta a assinatura da Anuntech" : "Falta a sua assinatura") : null;
          const term = c.term && c.term.state !== "upcoming" ? c.term : null;
          const subtitle = c.kind === "amendment" ? (c.parentTitle ? `Aditivo de ${c.parentTitle}` : "Aditivo") : null;
          return (
            <RecordRow
              kind="contract"
              title={c.title}
              status={{ label: c.statusLabel, tone: contractTone(c.status) }}
              details={[subtitle, showCompany ? c.company : null, termLine(c)].filter(Boolean).join(" · ") || undefined}
              note={missing ?? term?.label ?? undefined}
              noteTone={missing ? (c.signedBy.includes("client") ? "muted" : "warning") : term?.state === "expired" ? "destructive" : "warning"}
              onPress={() => router.push({ pathname: "/contratos/[id]", params: { id: c.id } })}
            />
          );
        }}
      />
    </>
  );
}
