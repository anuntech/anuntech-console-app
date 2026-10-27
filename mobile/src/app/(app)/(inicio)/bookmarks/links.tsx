import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Check } from "@/components/bookmark-pickers";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";

const EXPIRY = [
  { value: 1, label: "1 dia" },
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 0, label: "Sem prazo" },
] as const;
const STATE_LABELS = { active: "Ativo", expired: "Vencido", revoked: "Desligado", exhausted: "Limite de downloads atingido" } as const;

/**
 * "Compartilhar por link" (a file or a folder) and "Pedir arquivos" (a
 * folder), as the web's dialog: how long it lasts, a password, a download
 * limit, an e-mail; the address shows once, to copy or share; and the links
 * already made, to turn off.
 */
export default function ShareLinks() {
  const params = useLocalSearchParams<{ bookmarkId?: string; folderId?: string; kind?: string; title?: string }>();
  const request = params.kind === "request";
  const target = { bookmarkId: params.bookmarkId ?? "", folderId: params.folderId ?? "" };
  const links = useQuery({ queryKey: ["share-links", target.bookmarkId, target.folderId], queryFn: () => api.bookmarks.shareLinks(target) });
  const loading = useDelayed(links.isPending);
  const [expiry, setExpiry] = useState<number>(7);
  const [password, setPassword] = useState("");
  const [limit, setLimit] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const create = useMutation({
    mutationFn: () =>
      api.bookmarks.createShareLink({
        kind: request ? "request" : "download",
        ...target,
        expiresInDays: expiry || "",
        password,
        maxDownloads: !request && Number(limit) > 0 ? Math.min(10_000, Math.floor(Number(limit))) : "",
        email: email.trim(),
      }),
    onSuccess: ({ url: made }) => {
      haptic.success();
      setUrl(made);
      setPassword("");
      void links.refetch();
    },
    onError: () => haptic.error(),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.bookmarks.revokeShareLink({ id }),
    onSuccess: () => {
      haptic.success();
      void links.refetch();
    },
    onError: (error) => {
      haptic.error();
      Alert.alert("Não foi possível desligar", errorMessage(error));
    },
  });
  const tooShort = password.length > 0 && password.length < 6;
  const title = request ? "Pedir arquivos" : "Compartilhar por link";
  const shown = (links.data?.links ?? []).filter((l) => l.kind === (request ? "request" : "download"));
  return (
    <>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: space.xxl }}
        >
          <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.gutter + 4 }}>
            {request
              ? `Quem tiver o link envia arquivos para “${params.title ?? "a pasta"}”, sem conta e sem ver o que já está nela.`
              : `Quem tiver o link baixa “${params.title ?? "o arquivo"}”, sem conta.`}
          </Text>
          {url ? (
            <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
              <Notice kind="success" title="Link criado">
                Copie ou envie agora: por segurança, o endereço não aparece de novo.
              </Notice>
              <Text variant="caption" selectable numberOfLines={2}>
                {url}
              </Text>
              <Button
                title="Copiar link"
                icon="doc.on.doc"
                onPress={() => {
                  void Clipboard.setStringAsync(url);
                  haptic.success();
                }}
              />
              <Button title="Enviar…" variant="secondary" icon="square.and.arrow.up" onPress={() => void Share.share({ message: url })} />
              <Button title="Criar outro link" variant="plain" onPress={() => setUrl("")} />
            </View>
          ) : (
            <>
              <Section header="Vale por" inset={space.gutter} indent={space.lg}>
                {EXPIRY.map((option) => (
                  <ListRow
                    key={option.label}
                    title={option.label}
                    trailing={expiry === option.value ? <Check /> : "none"}
                    accessibilityRole="button"
                    accessibilityState={{ selected: expiry === option.value }}
                    onPress={() => {
                      haptic.select();
                      setExpiry(option.value);
                    }}
                  />
                ))}
              </Section>
              <View style={{ paddingHorizontal: space.gutter, gap: space.form }}>
                <Field
                  label="Senha (opcional)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="newPassword"
                  maxLength={100}
                  invalid={tooShort}
                />
                {!request ? (
                  <Field label="Limite de downloads (opcional)" value={limit} onChangeText={setLimit} keyboardType="number-pad" maxLength={5} placeholder="Sem limite" />
                ) : null}
                <Field
                  label="Enviar o link por e-mail (opcional)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={200}
                  placeholder="nome@empresa.com.br"
                />
                {tooShort ? <Notice kind="warning">Use uma senha de pelo menos 6 caracteres.</Notice> : null}
                {create.error ? <Notice kind="error">{errorMessage(create.error)}</Notice> : null}
                <Button
                  title={create.isPending ? "Criando…" : "Criar link"}
                  icon="link"
                  busy={create.isPending}
                  disabled={tooShort || create.isPending}
                  onPress={() => create.mutate()}
                />
              </View>
            </>
          )}
          {loading ? <SkeletonRows count={2} /> : null}
          {links.error ? (
            <View style={{ paddingHorizontal: space.gutter }}>
              <Notice kind="error">{errorMessage(links.error)}</Notice>
            </View>
          ) : null}
          {links.data ? (
            <Section header="Links criados" footer={shown.length ? undefined : "Nenhum ainda."} inset={space.gutter}>
              {shown.map((link) => (
                <ListRow
                  key={link.id}
                  title={`${STATE_LABELS[link.state]}${link.password ? " · com senha" : ""}`}
                  subtitle={[
                    `criado ${when(link.createdAt)}${link.by ? ` por ${link.by}` : ""}`,
                    link.expiresAt ? `vale até ${when(link.expiresAt)}` : "sem prazo",
                    request ? `${link.uploads} recebidos` : `${link.downloads}${link.maxDownloads ? ` de ${link.maxDownloads}` : ""} downloads`,
                  ].join(" · ")}
                  trailing="none"
                  onPress={
                    link.state === "active"
                      ? () =>
                          Alert.alert("Desligar o link?", "Quem tiver o endereço não abre mais.", [
                            { text: "Cancelar", style: "cancel" },
                            { text: "Desligar", style: "destructive", onPress: () => revoke.mutate(link.id) },
                          ])
                      : undefined
                  }
                  accessibilityHint={link.state === "active" ? "Desligar o link" : undefined}
                />
              ))}
            </Section>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
