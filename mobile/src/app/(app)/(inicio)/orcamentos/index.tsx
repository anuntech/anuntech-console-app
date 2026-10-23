import { useDeferredValue, useRef, useState } from "react";
import { Stack, router } from "expo-router";
import type { SearchBarCommands } from "react-native-screens";
import { FilterChips } from "@/components/filter-chips";
import { PagedList } from "@/components/paged-list";
import { RecordRow } from "@/components/record-card";
import { api } from "@/lib/api";
import { civilDate, money } from "@/lib/format";
import { useMe } from "@/lib/me";
import { HeaderIconButton } from "@/lib/stack";
import { relativeLabel } from "@/lib/tasks";
import { quoteTone } from "@/lib/tones";

type Status = "all" | "sent" | "accepted" | "declined" | "expired";

/** The web's situation filter for clients (quote-table's quoteFiltersFor). */
const filters: { value: Status; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "sent", label: "Aguardando resposta" },
  { value: "accepted", label: "Aceitos" },
  { value: "declined", label: "Recusados" },
  { value: "expired", label: "Expirados" },
];

/** "48–60h", or "10h" when the estimate is exact (quote-model's hoursLabel). */
const hoursLabel = (min: number, max: number) => (min === max ? `${max}h` : `${min}–${max}h`);

/** A client asks for a quote with a ticket of its own kind ("App ou projeto novo"), as the web's "Pedir orçamento". */
const askForQuote = () => router.push({ pathname: "/chamados/novo", params: { kind: "new_project" } });

/** The company's quotes, with the figures that were sent, by situation and with a search (quotes.list). */
export default function Quotes() {
  const me = useMe();
  // The team makes quotes on the web; the button is the client's.
  const canAsk = !!me.data && !me.data.staff;
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
            placeholder: "Buscar por número ou título",
            hideWhenScrolling: false,
            onChangeText: (e) => setSearch(e.nativeEvent.text),
          },
          headerRight: canAsk
            ? () => <HeaderIconButton symbol="plus" label="Pedir orçamento" tint="primary" testID="ask-quote" onPress={askForQuote} />
            : undefined,
        }}
      />
      <PagedList
        queryKey={["quotes", status, query]}
        load={(page) => api.quotes.list({ page, status, search: query })}
        header={<FilterChips options={filters} value={status} onChange={setStatus} group="Situação" />}
        empty={{
          icon: "list.bullet.rectangle",
          title: "Nenhum orçamento ainda",
          text: "Os orçamentos da Anuntech para a sua empresa aparecem aqui, para ler, baixar o PDF e responder. Precisa de um app, um sistema ou uma função nova? Peça um orçamento.",
          action: canAsk ? { label: "Pedir orçamento", icon: "plus", onPress: askForQuote } : undefined,
        }}
        filtered={
          status !== "all" || query
            ? {
                icon: "magnifyingglass",
                title: "Nenhum orçamento encontrado",
                text: "Tente outro termo ou mude os filtros.",
                action: { label: "Limpar filtros", onPress: clear },
              }
            : undefined
        }
        render={(q, showCompany) => {
          // Validity counts only before an answer: how long it still holds, or the date once it lapsed.
          const validity =
            q.status === "sent" && q.validUntil ? (q.validityLabel ?? `Válido até ${civilDate(q.validUntil)}`) : null;
          return (
            <RecordRow
              kind="quote"
              title={q.title}
              status={{ label: q.statusLabel, tone: q.expired ? "danger" : quoteTone(q.status) }}
              value={money(q.totalCents)}
              details={[
                `nº ${q.number}`,
                hoursLabel(q.hoursMin, q.hoursMax),
                showCompany ? q.company : null,
                // The web's last column: when the quote last changed.
                `Atualizado ${relativeLabel(q.updatedAt)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              note={validity ?? undefined}
              noteTone={q.expired ? "destructive" : "warning"}
              onPress={() => router.push({ pathname: "/orcamentos/[id]", params: { id: q.id } })}
            />
          );
        }}
      />
    </>
  );
}
