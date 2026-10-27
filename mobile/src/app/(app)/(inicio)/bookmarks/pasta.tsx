import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Check, CompanyPicker } from "@/components/bookmark-pickers";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { refreshBookmarks, useBookmarkChoices } from "@/lib/bookmarks";
import { showFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";

type Visibility = "company" | "people";

/** "Nova pasta" (company, name, who sees it) or, with `id`, "Renomear pasta" (only the name). */
export default function FolderScreen() {
  const params = useLocalSearchParams<{ id?: string; companyId?: string; parentId?: string }>();
  const choices = useBookmarkChoices();
  const loading = useDelayed(choices.isPending);
  const folder = params.id ? choices.data?.folders.find((f) => f.id === params.id) : undefined;
  const title = params.id ? "Renomear pasta" : "Nova pasta";
  const parent = params.parentId ? choices.data?.folders.find((f) => f.id === params.parentId) : undefined;
  if (params.id && choices.data && (!folder || !folder.manages))
    return (
      <>
        <Stack.Screen options={{ title }} />
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <EmptyState
            icon="folder.badge.questionmark"
            title="Pasta não encontrada"
            text="Ela pode ter sido excluída, ou só quem criou pode renomeá-la."
            action={router.canGoBack() ? { label: "Voltar", onPress: () => router.back() } : undefined}
          />
        </ScrollView>
      </>
    );
  return (
    <>
      <Stack.Screen options={{ title }} />
      {choices.data && (!params.id || folder) ? (
        <FolderForm
          key={folder?.id ?? "new"}
          folder={folder ? { id: folder.id, name: folder.name } : null}
          companies={choices.data.companies}
          initialCompany={parent?.companyId ?? params.companyId ?? ""}
          parent={parent ? { id: parent.id, name: parent.name } : null}
        />
      ) : (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: space.sm, gap: space.block }}>
          {loading ? <SkeletonRows count={3} /> : null}
          {choices.error ? (
            <View style={{ paddingHorizontal: space.gutter }}>
              <Notice kind="error">{errorMessage(choices.error)}</Notice>
            </View>
          ) : null}
        </ScrollView>
      )}
    </>
  );
}

function FolderForm({
  folder,
  companies,
  initialCompany,
  parent,
}: {
  folder: { id: string; name: string } | null;
  companies: { id: string; name: string }[];
  initialCompany: string;
  /** Inside this folder: its company, and who sees it, come from it. */
  parent: { id: string; name: string } | null;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [picked, setCompany] = useState(companies.some((c) => c.id === initialCompany) ? initialCompany : "");
  const [visibility, setVisibility] = useState<Visibility>("company");
  const [tried, setTried] = useState(false);
  const companyId = picked || (companies.length === 1 ? companies[0].id : "");
  const save = useMutation({
    mutationFn: () =>
      folder
        ? api.bookmarks.renameFolder({ id: folder.id, name: name.trim() })
        : api.bookmarks.createFolder({ companyId, name: name.trim(), visibility, parentId: parent?.id ?? "" }),
    onSuccess: async ({ message }) => {
      haptic.success();
      showFlash(message);
      await refreshBookmarks();
      router.back();
    },
    onError: () => haptic.error(),
  });
  const missing = !folder && !companyId ? "Escolha a empresa." : !name.trim() ? "Dê um nome à pasta." : null;
  const submit = () => {
    setTried(true);
    if (missing) return haptic.error();
    save.mutate();
  };
  const option = (value: Visibility, label: string) => (
    <ListRow
      key={value}
      title={label}
      trailing={visibility === value ? <Check /> : "none"}
      accessibilityRole="button"
      accessibilityState={{ selected: visibility === value }}
      accessibilityHint="Quem vê"
      onPress={() => {
        haptic.select();
        setVisibility(value);
      }}
    />
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: space.xxl }}
      >
        <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.gutter + 4 }}>
          {folder ? "Só o nome muda." : parent ? `Dentro de “${parent.name}”. Quem vê segue a pasta de cima.` : "Reúna os arquivos, links e lousas de uma empresa."}
        </Text>
        {!folder && !parent ? <CompanyPicker companies={companies} value={companyId} onChange={setCompany} /> : null}
        <View style={{ paddingHorizontal: space.gutter }}>
          <Field
            label="Nome"
            testID="folder-name"
            placeholder="Ex.: Referências de design"
            value={name}
            onChangeText={setName}
            maxLength={80}
            autoFocus
            invalid={tried && !name.trim()}
          />
        </View>
        {!folder && !parent ? (
          <Section header="Quem vê" footer="Pessoas escolhidas você define depois, em Compartilhar." inset={space.gutter} indent={space.lg}>
            {option("company", "Todos da empresa")}
            {option("people", "Só pessoas escolhidas")}
          </Section>
        ) : null}
        <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
          {tried && missing ? <Notice kind="warning">{missing}</Notice> : null}
          {save.error ? <Notice kind="error">{errorMessage(save.error)}</Notice> : null}
          <Button
            title={save.isPending ? (folder ? "Salvando…" : "Criando…") : folder ? "Salvar" : "Criar pasta"}
            icon={folder ? undefined : "folder.badge.plus"}
            testID="save-folder"
            busy={save.isPending}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
