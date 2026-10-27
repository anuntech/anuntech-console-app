import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "@/components/symbol";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Check } from "@/components/bookmark-pickers";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { refreshBookmarks, useBookmarkChoices, type BookmarkFolder } from "@/lib/bookmarks";
import { showFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { space, usePalette } from "@/lib/theme";

type Person = BookmarkFolder["sharedWith"][number];
type Visibility = "company" | "people";
const MAX_PEOPLE = 50;

/** "Compartilhar": the whole company, or people picked by name (the folder's owner only). */
export default function ShareFolder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const choices = useBookmarkChoices();
  const loading = useDelayed(choices.isPending);
  const folder = choices.data?.folders.find((f) => f.id === id);
  if (choices.data && (!folder || !folder.manages))
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <EmptyState
          icon="folder.badge.questionmark"
          title="Pasta não encontrada"
          text="Ela pode ter sido excluída, ou só quem criou pode compartilhá-la."
          action={router.canGoBack() ? { label: "Voltar", onPress: () => router.back() } : undefined}
        />
      </ScrollView>
    );
  if (folder) return <ShareForm key={folder.id} folder={folder} />;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: space.sm, gap: space.block }}>
      {loading ? <SkeletonRows count={3} /> : null}
      {choices.error ? (
        <View style={{ paddingHorizontal: space.gutter }}>
          <Notice kind="error">{errorMessage(choices.error)}</Notice>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ShareForm({ folder }: { folder: BookmarkFolder }) {
  const palette = usePalette();
  const [mode, setMode] = useState<Visibility>(folder.visibility);
  const [adds, setAdds] = useState<"viewers" | "owner">(folder.adds ?? "viewers");
  const [chosen, setChosen] = useState<Person[]>(folder.sharedWith);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  // The web waits a quarter second after the last key before asking.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useQuery({
    queryKey: ["bookmark-people", folder.id, term],
    queryFn: () => api.bookmarks.searchPeople({ folderId: folder.id, query: term }),
    enabled: mode === "people" && term.length > 0,
  });
  const save = useMutation({
    mutationFn: () => api.bookmarks.shareFolder({ id: folder.id, visibility: mode, userIds: mode === "people" ? chosen.map((p) => p.id) : [], adds }),
    onSuccess: async ({ message }) => {
      haptic.success();
      showFlash(message);
      await refreshBookmarks();
      router.back();
    },
    onError: () => haptic.error(),
  });
  const picked = (personId: string) => chosen.some((p) => p.id === personId);
  const toggle = (person: Person) => {
    haptic.select();
    setChosen((current) => (picked(person.id) ? current.filter((p) => p.id !== person.id) : [...current, person]));
  };
  const tooMany = mode === "people" && chosen.length > MAX_PEOPLE;
  const option = (value: Visibility, label: string) => (
    <ListRow
      key={value}
      title={label}
      trailing={mode === value ? <Check /> : "none"}
      accessibilityRole="button"
      accessibilityState={{ selected: mode === value }}
      accessibilityHint="Quem vê"
      onPress={() => {
        haptic.select();
        setMode(value);
      }}
    />
  );
  const people = results.data?.people ?? [];
  return (
    <>
      <Stack.Screen options={{ title: `Compartilhar “${folder.name}”` }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: space.xxl }}
        >
          <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.gutter + 4 }}>
            Quem vê a pasta também pode adicionar bookmarks nela.
          </Text>
          <Section header="Quem vê" inset={space.gutter} indent={space.lg}>
            {option("company", "Todos da empresa")}
            {option("people", "Só pessoas escolhidas")}
          </Section>
          <Section header="Quem vê pode" footer="Em “Só ver e baixar”, só você e a equipe da Anuntech adicionam itens." inset={space.gutter} indent={space.lg}>
            {(
              [
                ["viewers", "Ver, baixar e adicionar itens"],
                ["owner", "Só ver e baixar"],
              ] as const
            ).map(([value, label]) => (
              <ListRow
                key={value}
                title={label}
                trailing={adds === value ? <Check /> : "none"}
                accessibilityRole="button"
                accessibilityState={{ selected: adds === value }}
                onPress={() => {
                  haptic.select();
                  setAdds(value);
                }}
              />
            ))}
          </Section>
          {mode === "people" ? (
            <>
              {chosen.length > 0 ? (
                <Section header="Pessoas" inset={space.gutter} indent={60}>
                  {chosen.map((person) => (
                    <ListRow
                      key={person.id}
                      leading={<Avatar avatar={person.avatar} name={person.name} size={32} />}
                      title={person.name}
                      trailing={<SymbolView name="minus.circle.fill" size={20} tintColor={palette.destructive} accessible={false} />}
                      accessibilityLabel={`Remover ${person.name}`}
                      onPress={() => toggle(person)}
                    />
                  ))}
                </Section>
              ) : (
                <Text variant="caption" tone="muted" style={{ marginHorizontal: space.gutter + 4 }}>
                  Sem ninguém escolhido, só você vê a pasta.
                </Text>
              )}
              <View style={{ paddingHorizontal: space.gutter }}>
                <Field
                  label="Adicionar pessoa"
                  testID="share-search"
                  placeholder="Buscar pessoa pelo nome"
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  maxLength={80}
                  returnKeyType="search"
                />
              </View>
              {term ? (
                results.isPending ? (
                  <ActivityIndicator accessibilityLabel="Buscando" />
                ) : results.error ? (
                  <View style={{ paddingHorizontal: space.gutter }}>
                    <Notice kind="error">{errorMessage(results.error)}</Notice>
                  </View>
                ) : people.length ? (
                  <Section header="Resultados" inset={space.gutter} indent={60}>
                    {people.map((person) => (
                      <ListRow
                        key={person.id}
                        leading={<Avatar avatar={person.avatar} name={person.name} size={32} />}
                        title={person.name}
                        trailing={picked(person.id) ? <Check /> : "none"}
                        accessibilityRole="button"
                        accessibilityState={{ selected: picked(person.id) }}
                        accessibilityLabel={picked(person.id) ? `${person.name}, escolhida` : person.name}
                        onPress={() => toggle(person)}
                      />
                    ))}
                  </Section>
                ) : (
                  <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.gutter + 4 }}>
                    Ninguém com esse nome.
                  </Text>
                )
              ) : null}
            </>
          ) : null}
          <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
            {tooMany ? <Notice kind="warning">Compartilhe com até 50 pessoas.</Notice> : null}
            {save.error ? <Notice kind="error">{errorMessage(save.error)}</Notice> : null}
            <Button
              title={save.isPending ? "Salvando…" : "Salvar"}
              testID="save-share"
              busy={save.isPending}
              disabled={tooMany}
              onPress={() => save.mutate()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
