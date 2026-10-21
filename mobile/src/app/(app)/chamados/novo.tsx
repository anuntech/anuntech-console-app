import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { Field } from "@/components/field";
import { Notice } from "@/components/surface";
import { api, errorMessage } from "@/lib/api";
import { space } from "@/lib/theme";

type Kind = "problem" | "question" | "change" | "access" | "new_project";
type Impact = "down" | "workaround" | "other";

/** Opening a ticket (tickets.create), with the same choices as the web form. */
export default function NewTicket() {
  const queryClient = useQueryClient();
  const choices = useQuery({ queryKey: ["ticket-choices"], queryFn: () => api.tickets.choices({}) });
  const [picked, setCompany] = useState<string>();
  const [engagementId, setEngagement] = useState("");
  const [kind, setKind] = useState<Kind>();
  const [impact, setImpact] = useState<Impact>();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const companies = choices.data?.companies ?? [];
  // With one company there is nothing to pick.
  const companyId = picked ?? (companies.length === 1 ? companies[0].id : undefined);
  const products = (choices.data?.engagements ?? []).filter((e) => e.companyId === companyId);
  const create = useMutation({
    mutationFn: () =>
      api.tickets.create({
        companyId: companyId!,
        engagementId,
        kind: kind!,
        impact: kind === "problem" ? impact : undefined,
        subject: subject.trim(),
        body: body.trim(),
      }),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      router.replace({ pathname: "/chamados/[id]", params: { id } });
    },
  });
  const hint = choices.data?.kinds.find((k) => k.value === kind)?.hint;
  const ready =
    !!companyId && !!kind && (kind !== "problem" || !!impact) && !!subject.trim() && !!body.trim();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, gap: space.form, paddingBottom: space.block * 2 }}
      >
        {choices.isPending && <ActivityIndicator accessibilityLabel="Carregando" />}
        {choices.error && <Notice kind="error">{errorMessage(choices.error)}</Notice>}
        {choices.data && (
          <>
            {companies.length > 1 && (
              <View style={{ gap: space.sm }}>
                <Text variant="label">Empresa</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  {companies.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={companyId === c.id}
                      onPress={() => {
                        setCompany(c.id);
                        setEngagement("");
                      }}
                    />
                  ))}
                </View>
              </View>
            )}
            {products.length > 0 && (
              <View style={{ gap: space.sm }}>
                <Text variant="label">Produto ou serviço (opcional)</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  {products.map((e) => (
                    <Chip
                      key={e.id}
                      label={e.name}
                      selected={engagementId === e.id}
                      onPress={() => setEngagement(engagementId === e.id ? "" : e.id)}
                    />
                  ))}
                </View>
              </View>
            )}
            <View style={{ gap: space.sm }}>
              <Text variant="label">O que você precisa?</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {choices.data.kinds.map((k) => (
                  <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value as Kind)} />
                ))}
              </View>
              {hint ? (
                <Text variant="caption" tone="muted">
                  {hint}
                </Text>
              ) : null}
            </View>
            {kind === "problem" && (
              <View style={{ gap: space.sm }}>
                <Text variant="label">Qual o impacto?</Text>
                <View style={{ gap: space.sm }}>
                  {choices.data.impacts.map((i) => (
                    <Chip key={i.value} label={i.label} selected={impact === i.value} onPress={() => setImpact(i.value as Impact)} />
                  ))}
                </View>
              </View>
            )}
            <Field label="Assunto" testID="subject" value={subject} onChangeText={setSubject} maxLength={160} />
            <Field
              label="Descrição"
              testID="body"
              value={body}
              onChangeText={setBody}
              maxLength={10000}
              multiline
              style={{ minHeight: 140, paddingTop: space.md, textAlignVertical: "top" }}
            />
            {create.error ? <Notice kind="error">{errorMessage(create.error)}</Notice> : null}
            <Button
              title={create.isPending ? "Abrindo…" : "Abrir chamado"}
              testID="create-ticket"
              busy={create.isPending}
              disabled={!ready}
              onPress={() => create.mutate()}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
