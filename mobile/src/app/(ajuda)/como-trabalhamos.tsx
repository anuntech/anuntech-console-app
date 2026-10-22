import { useEffect, useRef } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpBlockView } from "@/components/help-content";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { Card, Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { followHelpLink, useAppReach } from "@/lib/help-routes";
import { useTabBarSpace } from "@/lib/layout";
import { space } from "@/lib/theme";

type Guide = Awaited<ReturnType<typeof api.guide.get>>;
type Facts = { text: string }[];

/** One product's or contract's facts under its name. */
function FactList({ title, facts }: { title: string; facts: Facts }) {
  if (!facts.length) return null;
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="caption" tone="muted">
        {title}
      </Text>
      {facts.map((f) => (
        <View key={f.text} style={{ flexDirection: "row", gap: space.sm }}>
          <Text variant="subhead" tone="muted">
            •
          </Text>
          <Text variant="subhead" style={{ flex: 1 }} selectable>
            {f.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The company's own terms inside a section: a soft panel, so it reads as "yours" next to the general text. */
function TermsPanels({ terms, title, pick }: { terms: Guide["terms"]; title: string; pick: "promises" | "asks" }) {
  const many = terms.length > 1;
  return terms
    .filter((c) => c.items.some((i) => i[pick].length))
    .map((c) => (
      <Card key={c.company} style={{ gap: space.md }}>
        <Text variant="label">
          {title}
          {many ? <Text variant="subhead" tone="muted">{`  ${c.company}`}</Text> : null}
        </Text>
        {c.items.map((item) => (
          <FactList key={item.title} title={item.title} facts={item[pick]} />
        ))}
      </Card>
    ));
}

/**
 * Como trabalhamos (guide.get): how Anuntech works with its clients, with
 * each company's published deadlines and what its contract asks. Opening it
 * counts as reading it (guide.markRead), as on the web.
 */
export default function HowWeWork() {
  const bottom = useTabBarSpace();
  const reach = useAppReach();
  const queryClient = useQueryClient();
  const guide = useQuery({ queryKey: ["guide"], queryFn: () => api.guide.get({}) });
  const loading = useDelayed(guide.isPending);
  const markRead = useMutation({
    mutationFn: () => api.guide.markRead({}),
    // The first step "Leia como trabalhamos com vocês" is done now.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["first-steps"] }),
  });
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markRead.mutate();
  }, [markRead]);
  const g = guide.data;
  const onLink = (href: string) => followHelpLink(href, reach, "help");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.xl, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={guide.isRefetching} onRefresh={() => void guide.refetch()} />}
    >
      {loading ? (
        <>
          <SkeletonHeader />
          <SkeletonRows count={3} inset={0} />
        </>
      ) : null}
      {guide.error ? <Notice kind="error">{errorMessage(guide.error)}</Notice> : null}
      {g ? (
        <>
          {g.staff ? (
            <Notice kind="info">
              Esta é a página que os clientes leem. Os prazos de cada empresa entram em Condições de atendimento, na página da empresa, e aparecem aqui para ela.
            </Notice>
          ) : null}
          {g.sections.map((s) => (
            <View key={s.id} style={{ gap: space.md }}>
              <View style={{ gap: space.xs }}>
                <Text variant="heading" accessibilityRole="header">
                  {s.title}
                </Text>
                <Text variant="subhead" tone="muted">
                  {s.lead}
                </Text>
              </View>
              {s.blocks.map((block, i) => (
                <HelpBlockView key={i} block={block} onLink={onLink} />
              ))}
              {s.id === "tempo" ? <TermsPanels terms={g.terms} title="Seus prazos" pick="promises" /> : null}
              {s.id === "voce" ? <TermsPanels terms={g.terms} title="O que o seu contrato pede" pick="asks" /> : null}
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
