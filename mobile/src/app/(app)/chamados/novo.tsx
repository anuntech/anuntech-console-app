import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { space, usePalette, type tile } from "@/lib/theme";

type Kind = "problem" | "question" | "change" | "access" | "new_project";
type Impact = "down" | "workaround" | "other";
type Block = "company" | "kind" | "impact" | "fields" | "subject" | "body";

/** Each kind of request with its tile, so the five read at a glance. */
const kindLook: Record<Kind, { icon: SFSymbol; color: keyof typeof tile }> = {
  problem: { icon: "exclamationmark.triangle.fill", color: "red" },
  question: { icon: "questionmark.circle.fill", color: "violet" },
  change: { icon: "slider.horizontal.3", color: "teal" },
  access: { icon: "key.fill", color: "gray" },
  new_project: { icon: "sparkles", color: "ink" },
};

/** The trailing check of the chosen row (never color alone). */
function Check() {
  const palette = usePalette();
  return <SymbolView name="checkmark" size={17} weight="semibold" tintColor={palette.primary} accessible={false} />;
}

/** "a, b e c" */
function list(items: string[]) {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Opening a ticket (tickets.create), with the same choices as the web form. */
export default function NewTicket() {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Where each block sits in the scroll, to bring the first missing one into view.
  const positions = useRef<Partial<Record<Block, number>>>({});
  const choices = useQuery({ queryKey: ["ticket-choices"], queryFn: () => api.tickets.choices({}) });
  const loading = useDelayed(choices.isPending);
  const [picked, setCompany] = useState<string>();
  const [engagementId, setEngagement] = useState("");
  const [kind, setKind] = useState<Kind>();
  const [impact, setImpact] = useState<Impact>();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tried, setTried] = useState(false);
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
      haptic.success();
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      router.replace({ pathname: "/chamados/[id]", params: { id } });
    },
    onError: () => haptic.error(),
  });
  const missing: Block[] = [
    ...(!companyId ? (["company"] as const) : []),
    ...(!kind ? (["kind"] as const) : []),
    ...(kind === "problem" && !impact ? (["impact"] as const) : []),
    ...(!subject.trim() ? (["subject"] as const) : []),
    ...(!body.trim() ? (["body"] as const) : []),
  ];
  const ready = missing.length === 0;
  const pick = [
    ...(companies.length > 1 ? ["a empresa"] : []),
    "o tipo",
    ...(kind === "problem" ? ["o impacto"] : []),
  ];
  const warning = `Escolha ${list(pick)}${pick.length > 1 ? "," : ""} e preencha assunto e descrição.`;
  const submit = () => {
    if (ready) return create.mutate();
    setTried(true);
    const where = positions.current;
    const block = missing[0];
    // The two fields sit inside the padded block, so their offsets add to its own.
    const y = block === "subject" || block === "body" ? (where.fields ?? 0) + (where[block] ?? 0) : where[block];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - space.lg), animated: !reduceMotion });
  };
  const choose = (apply: () => void) => () => {
    haptic.select();
    apply();
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: space.xxl }}
      >
        {loading && <SkeletonRows count={5} />}
        {choices.error && (
          <View style={{ paddingHorizontal: space.gutter }}>
            <Notice kind="error">{errorMessage(choices.error)}</Notice>
          </View>
        )}
        {choices.data && (
          <>
            {companies.length > 1 && (
              <View onLayout={(e) => (positions.current.company = e.nativeEvent.layout.y)}>
                <Section header="Empresa" inset={space.gutter} indent={space.lg}>
                  {companies.map((c) => (
                    <ListRow
                      key={c.id}
                      title={c.name}
                      trailing={companyId === c.id ? <Check /> : "none"}
                      accessibilityLabel={companyId === c.id ? `${c.name}, selecionada` : c.name}
                      accessibilityHint="Empresa"
                      onPress={choose(() => {
                        setCompany(c.id);
                        if (c.id !== companyId) setEngagement("");
                      })}
                    />
                  ))}
                </Section>
              </View>
            )}
            <View onLayout={(e) => (positions.current.kind = e.nativeEvent.layout.y)}>
              <Section header="O que você precisa?" inset={space.gutter}>
                {choices.data.kinds.map((k) => {
                  const look = kindLook[k.value as Kind] ?? kindLook.question;
                  const selected = kind === k.value;
                  return (
                    <ListRow
                      key={k.value}
                      leading={<IconTile icon={look.icon} color={look.color} />}
                      title={k.label}
                      subtitle={k.hint}
                      trailing={selected ? <Check /> : "none"}
                      accessibilityLabel={[k.label, k.hint, selected ? "selecionado" : null].filter(Boolean).join(", ")}
                      accessibilityHint="O que você precisa?"
                      onPress={choose(() => setKind(k.value as Kind))}
                    />
                  );
                })}
              </Section>
            </View>
            {kind === "problem" && (
              <View onLayout={(e) => (positions.current.impact = e.nativeEvent.layout.y)}>
                <Section header="Qual o impacto?" inset={space.gutter} indent={space.lg}>
                  {choices.data.impacts.map((i) => (
                    <ListRow
                      key={i.value}
                      title={i.label}
                      trailing={impact === i.value ? <Check /> : "none"}
                      accessibilityLabel={impact === i.value ? `${i.label}, selecionado` : i.label}
                      accessibilityHint="Qual o impacto?"
                      onPress={choose(() => setImpact(i.value as Impact))}
                    />
                  ))}
                </Section>
              </View>
            )}
            {products.length > 0 && (
              <Section header="Produto ou serviço · opcional" inset={space.gutter}>
                {products.map((e) => (
                  <ListRow
                    key={e.id}
                    leading={<IconTile icon="globe" color="gray" />}
                    title={e.name}
                    trailing={engagementId === e.id ? <Check /> : "none"}
                    accessibilityLabel={engagementId === e.id ? `${e.name}, selecionado` : e.name}
                    accessibilityHint="Produto ou serviço, opcional. Toque de novo para desmarcar."
                    onPress={choose(() => setEngagement(engagementId === e.id ? "" : e.id))}
                  />
                ))}
              </Section>
            )}
            <View onLayout={(e) => (positions.current.fields = e.nativeEvent.layout.y)} style={{ paddingHorizontal: space.gutter, gap: space.form }}>
              <View onLayout={(e) => (positions.current.subject = e.nativeEvent.layout.y)}>
                <Field
                  label="Assunto"
                  testID="subject"
                  placeholder="Ex.: Formulário de contato não envia"
                  value={subject}
                  onChangeText={setSubject}
                  maxLength={160}
                  invalid={tried && !subject.trim()}
                />
              </View>
              <View onLayout={(e) => (positions.current.body = e.nativeEvent.layout.y)}>
                <Field
                  label="Descrição"
                  testID="body"
                  placeholder="O que aconteceu, onde e desde quando"
                  hint="A equipe responde por aqui e no seu WhatsApp."
                  value={body}
                  onChangeText={setBody}
                  maxLength={10000}
                  multiline
                  invalid={tried && !body.trim()}
                  style={{ minHeight: 140, paddingTop: space.md, textAlignVertical: "top" }}
                />
              </View>
            </View>
            <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
              {tried && !ready ? <Notice kind="warning">{warning}</Notice> : null}
              {create.error ? <Notice kind="error">{errorMessage(create.error)}</Notice> : null}
              <Button
                title={create.isPending ? "Abrindo…" : "Abrir chamado"}
                icon="paperplane.fill"
                testID="create-ticket"
                busy={create.isPending}
                onPress={submit}
              />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
