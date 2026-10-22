import { RefreshControl, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { CATEGORY_SYMBOLS, FaqList, HelpSections } from "@/components/help-content";
import { NotFoundHelp } from "@/components/help-not-found";
import { TutorialCard } from "@/components/help-tutorial";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SectionHeader } from "@/components/section-header";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { civilDate } from "@/lib/format";
import { followHelpLink, useAppReach } from "@/lib/help-routes";
import { useTabBarSpace } from "@/lib/layout";
import { space } from "@/lib/theme";

type Stub = Awaited<ReturnType<typeof api.help.get>>["related"][number];

function Links({ title, articles }: { title: string; articles: Stub[] }) {
  if (!articles.length) return null;
  return (
    <Section header={title} indent={16}>
      {articles.map((a) => (
        <ListRow
          key={a.slug}
          title={a.title}
          meta={[a.adminOnly ? "Administrador" : null, a.video ? "Vídeo" : null].filter(Boolean).join(" · ") || undefined}
          onPress={() => router.push({ pathname: "/ajuda/[slug]", params: { slug: a.slug } })}
        />
      ))}
    </Section>
  );
}

/**
 * One help article (help.get): what it is, who does it, the video, the steps
 * and rules, the common questions, where to do it in the app, and the
 * articles around it. Links in the text open the app's screen when it has
 * one, otherwise the Console in the browser.
 */
export default function HelpArticle() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const bottom = useTabBarSpace();
  const reach = useAppReach();
  const article = useQuery({ queryKey: ["help-article", slug], queryFn: () => api.help.get({ slug }) });
  const loading = useDelayed(article.isPending);
  const a = article.data;
  const onLink = (href: string) => followHelpLink(href, reach, "help");
  const missing = article.error instanceof ORPCError && article.error.status === 404;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={article.isRefetching} onRefresh={() => void article.refetch()} />}
    >
      {loading ? (
        <>
          <SkeletonHeader />
          <SkeletonRows count={3} inset={0} />
        </>
      ) : null}
      {missing ? (
        <EmptyState
          icon="questionmark.circle"
          title="Artigo não encontrado"
          text="Ele pode ter mudado de nome. Veja todos os assuntos da Ajuda."
          action={{ label: "Ver a Ajuda", onPress: () => router.replace("/ajuda") }}
        />
      ) : article.error ? (
        <Notice kind="error">{errorMessage(article.error)}</Notice>
      ) : null}
      {a ? (
        <>
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <IconTile icon={CATEGORY_SYMBOLS[a.category.id] ?? "questionmark.circle.fill"} color="violet" size={24} />
              <Text variant="caption" tone="muted">
                Ajuda · {a.category.title}
              </Text>
            </View>
            <Text variant="title" accessibilityRole="header">
              {a.title}
            </Text>
            <Text variant="subhead" tone="muted">
              {a.summary}
            </Text>
            {a.adminOnly && !a.readsAsMember ? (
              <Text variant="caption" tone="muted">
                Só o Administrador da empresa faz isto no Console.
              </Text>
            ) : null}
          </View>
          {a.readsAsMember ? (
            <Notice kind="info">
              Quem faz isto é um Administrador da sua empresa. Você pode ler para entender o processo e, se precisar, pedir a ele ou abrir um chamado.
            </Notice>
          ) : null}
          {a.tutorial ? <TutorialCard tutorial={a.tutorial} /> : null}
          <HelpSections sections={a.sections} onLink={onLink} />
          {a.actions.length ? (
            <Section indent={16}>
              {a.actions.map((action) => (
                <ListRow key={action.href} title={action.label} tone="primary" onPress={() => onLink(action.href)} />
              ))}
            </Section>
          ) : null}
          {a.faq.length ? (
            <View>
              <SectionHeader title="Perguntas frequentes" />
              <FaqList faq={a.faq} onLink={onLink} />
            </View>
          ) : null}
          <Text variant="caption" tone="muted">
            Atualizado em {civilDate(a.updatedAt)}
          </Text>
          <NotFoundHelp canOpenTicket={a.canOpenTicket} />
          <Links title="Relacionados" articles={a.related} />
          <Links title={`Mais em ${a.category.title}`} articles={a.siblings} />
          <Section>
            <ListRow title="Todos os assuntos" leading={<IconTile icon="questionmark.circle.fill" color="teal" />} onPress={() => router.dismissTo("/ajuda")} />
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}
