import { useDeferredValue, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Stack, router } from "expo-router";
import { SymbolView } from "@/components/symbol";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { CATEGORY_SYMBOLS, FaqList } from "@/components/help-content";
import { NotFoundHelp } from "@/components/help-not-found";
import { durationLabel } from "@/components/help-tutorial";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SectionHeader } from "@/components/section-header";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { followHelpLink, useAppReach } from "@/lib/help-routes";
import { useTabBarSpace } from "@/lib/layout";
import { space, usePalette } from "@/lib/theme";

type Stub = Awaited<ReturnType<typeof api.help.home>>["categories"][number]["articles"][number];

const openArticle = (slug: string) => router.push({ pathname: "/ajuda/[slug]", params: { slug } });

/** An article's line: its title, the Administrador mark for a Membro and the video mark. */
function ArticleRow({ article, summary }: { article: Pick<Stub, "slug" | "title" | "summary"> & Partial<Pick<Stub, "adminOnly" | "video">>; summary?: boolean }) {
  const palette = usePalette();
  const marks = [article.adminOnly ? "Administrador" : null, article.video ? "Vídeo" : null].filter(Boolean).join(" · ");
  return (
    <ListRow
      title={article.title}
      subtitle={summary ? article.summary : undefined}
      meta={
        marks ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {article.video ? <SymbolView name="play.fill" size={10} tintColor={palette.primary} accessible={false} /> : null}
            <Text variant="caption" tone={article.video && !article.adminOnly ? "primary" : "muted"}>
              {marks}
            </Text>
          </View>
        ) : undefined
      }
      accessibilityLabel={[article.title, summary ? article.summary : null, marks || null].filter(Boolean).join(", ")}
      onPress={() => openArticle(article.slug)}
    />
  );
}

/**
 * Ajuda: the search over every article, the tutorial videos, each subject
 * with its articles, the common questions and where to ask when the answer
 * is not here (help.home, help.search). Everyone reads everything; what only
 * an Administrador does is marked for a Membro.
 */
export default function HelpHub() {
  const bottom = useTabBarSpace();
  const reach = useAppReach();
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const home = useQuery({ queryKey: ["help-home"], queryFn: () => api.help.home({}) });
  const search = useQuery({
    queryKey: ["help-search", q],
    queryFn: () => api.help.search({ q }),
    enabled: !!q,
    placeholderData: keepPreviousData,
  });
  const loading = useDelayed(home.isPending);
  const data = home.data;
  const results = search.data ?? [];
  const onLink = (href: string) => followHelpLink(href, reach, "help");

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Boleto, convite, prazo, contrato…",
            hideWhenScrolling: false,
            autoCapitalize: "none",
            onChangeText: (e) => setQuery(e.nativeEvent.text),
          },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => void home.refetch()} />}
      >
        {home.error ? <Notice kind="error">{errorMessage(home.error)}</Notice> : null}
        {q ? (
          <>
            {search.error ? <Notice kind="error">{errorMessage(search.error)}</Notice> : null}
            {search.isPending ? (
              <SkeletonRows count={3} inset={0} />
            ) : results.length ? (
              <Section
                header={`${results.length} ${results.length === 1 ? "artigo encontrado" : "artigos encontrados"}`}
                indent={16}
                style={{ opacity: search.isPlaceholderData ? 0.6 : 1 }}
              >
                {results.map((article) => (
                  <ArticleRow key={article.slug} article={article} summary />
                ))}
              </Section>
            ) : search.error ? null : (
              <EmptyState icon="magnifyingglass" title="Nenhum artigo encontrado" text="Tente outra palavra, como boleto, convite, prazo ou contrato." />
            )}
            <NotFoundHelp canOpenTicket={data?.canOpenTicket ?? true} />
          </>
        ) : (
          <>
            {loading ? <SkeletonRows count={5} inset={0} /> : null}
            {data ? (
              <>
                {data.tutorials.length ? (
                  <View>
                    <SectionHeader title="Tutoriais em vídeo" />
                    <Section indent={60}>
                      {data.tutorials.map((t) => (
                        <ListRow
                          key={t.id}
                          leading={<IconTile icon="play.fill" color="violet" />}
                          title={t.title}
                          subtitle={`${durationLabel(t.duration)} · ${t.description}`}
                          accessibilityLabel={`Vídeo: ${t.title}, ${durationLabel(t.duration)}. ${t.description}`}
                          onPress={() => openArticle(t.slug)}
                        />
                      ))}
                    </Section>
                  </View>
                ) : null}
                <View style={{ gap: space.lg }}>
                  <SectionHeader title="Assuntos" />
                  <Section>
                    <ListRow
                      title="Como trabalhamos"
                      subtitle="Chamados, prazos, projetos e contratação"
                      leading={<IconTile icon="book.fill" color="teal" />}
                      onPress={() => router.push("/como-trabalhamos")}
                    />
                  </Section>
                  {data.categories.map((category) => (
                    <View key={category.id} style={{ gap: space.sm }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginHorizontal: 4 }}>
                        <IconTile icon={CATEGORY_SYMBOLS[category.id] ?? "questionmark.circle.fill"} color="violet" size={28} />
                        <Text variant="headline" accessibilityRole="header">
                          {category.title}
                        </Text>
                      </View>
                      <Section indent={16}>
                        {category.articles.map((article) => (
                          <ArticleRow key={article.slug} article={article} />
                        ))}
                      </Section>
                    </View>
                  ))}
                </View>
                {data.faq.length ? (
                  <View>
                    <SectionHeader title="Perguntas frequentes" />
                    <FaqList
                      faq={data.faq}
                      onLink={onLink}
                      more={(item) => (item.slug ? { label: "Ler o artigo", onPress: () => openArticle(item.slug!) } : undefined)}
                    />
                  </View>
                ) : null}
                <NotFoundHelp canOpenTicket={data.canOpenTicket} />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}
