import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AttachmentField, uploadIds, uploading, type Attachment } from "@/components/attachment-field";
import { Button } from "@/components/button";
import { DictationBar } from "@/components/dictation";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { appendTranscript, useDictation } from "@/lib/dictation";
import { haptic } from "@/lib/haptics";
import { openHelp } from "@/lib/help-link";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { rounded, space, usePalette, type tile } from "@/lib/theme";

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

/** The web's link slugs (/chamados/novo?tipo=novo-projeto), and the kinds themselves. */
const kindSlugs: Record<string, Kind> = {
  erro: "problem",
  duvida: "question",
  ajuste: "change",
  acesso: "access",
  "novo-projeto": "new_project",
  problem: "problem",
  question: "question",
  change: "change",
  access: "access",
  new_project: "new_project",
};

const PRIVACY = "Não escreva senhas nem dados reais dos seus clientes. Se a equipe precisar de um acesso, ela combina com você um jeito seguro.";

/** The trailing check of the chosen row (never color alone). */
function Check() {
  const palette = usePalette();
  return <SymbolView name="checkmark" size={17} weight="semibold" tintColor={palette.primary} accessible={false} />;
}

/** "a, b e c" */
function list(items: string[]) {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** A quiet box under a field: what happens next, never a promise the contract does not make. */
function Note({ icon, strong, children }: { icon: SFSymbol; strong?: boolean; children: ReactNode }) {
  const palette = usePalette();
  return (
    <View
      accessible
      style={{
        flexDirection: "row",
        gap: 10,
        padding: 14,
        ...rounded(16),
        backgroundColor: strong ? palette.accent : palette.secondary,
      }}
    >
      <SymbolView name={icon} size={16} tintColor={strong ? palette.primary : palette.muted} accessible={false} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 4 }}>{children}</View>
    </View>
  );
}

/** "Talvez isto responda": articles of the Ajuda that match what the person typed (help.search). */
function HelpSuggestions({ text, prefer }: { text: string; prefer: boolean }) {
  const palette = usePalette();
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const enough = (settled.match(/\p{L}/gu)?.length ?? 0) >= 4;
  const found = useQuery({
    queryKey: ["help-search", prefer ? "question" : "ticket", settled],
    queryFn: () => api.help.search({ q: settled, for: prefer ? "question" : "ticket" }),
    enabled: enough,
    staleTime: 5 * 60_000,
  });
  const matches = enough ? (found.data ?? []) : [];
  if (!matches.length) return null;
  return (
    <View style={{ gap: space.sm, padding: space.md, ...rounded(16), borderWidth: 1, borderColor: palette.infoEdge, backgroundColor: palette.accent }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <SymbolView name="lifepreserver" size={14} tintColor={palette.primary} accessible={false} />
        <Text variant="micro" accessibilityRole="header">
          Talvez isto responda
        </Text>
      </View>
      {matches.map((article) => (
        <ListRow
          key={article.slug}
          title={
            <Text variant="label" tone="primary">
              {article.title}
            </Text>
          }
          subtitle={article.summary}
          accessibilityLabel={`${article.title}. ${article.summary}`}
          accessibilityHint="Abre o artigo da Ajuda"
          onPress={() => openHelp(article.slug)}
        />
      ))}
      <Text variant="caption" tone="muted">
        Se não resolver, siga com o chamado. Nada do que você escreveu se perde.
      </Text>
    </View>
  );
}

/**
 * Opening a ticket (tickets.create), with the same choices as the web form.
 * Links fill it in: `companyId`, `kind` (duvida, erro, ajuste, acesso,
 * novo-projeto, or the kind itself) and `engagementId`, as "Pedir orçamento",
 * a service, a closed ticket or the Ajuda's "Não encontrou?" do.
 */
export default function NewTicket() {
  const palette = usePalette();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const bottom = useTabBarSpace();
  const me = useMe();
  const params = useLocalSearchParams<{ companyId?: string; kind?: string; engagementId?: string }>();
  const linkedKind = params.kind ? kindSlugs[params.kind] : undefined;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Where each block sits in the scroll, to bring the first missing one into view.
  const positions = useRef<Partial<Record<Block, number>>>({});
  const choices = useQuery({ queryKey: ["ticket-choices"], queryFn: () => api.tickets.choices({}) });
  const loading = useDelayed(choices.isPending);
  const [picked, setCompany] = useState<string>();
  const [chosenProduct, setEngagement] = useState(params.engagementId ?? "");
  const [kind, setKind] = useState<Kind | undefined>(linkedKind);
  const [impact, setImpact] = useState<Impact>();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const dictation = useDictation((text) => {
    const result = appendTranscript(body, text, 10000);
    setBody(result.value);
    if (result.truncated) return "O texto passou do limite de 10.000 caracteres e foi cortado. Revise antes de enviar.";
  });
  const [tried, setTried] = useState(false);
  const companies = choices.data?.companies ?? [];
  // A link's company counts only when the person may open tickets for it; with one company there is nothing to pick.
  const linkedCompany = companies.some((c) => c.id === params.companyId) ? params.companyId : undefined;
  const companyId = picked ?? linkedCompany ?? (companies.length === 1 ? companies[0].id : undefined);
  const products = (choices.data?.engagements ?? []).filter((e) => e.companyId === companyId);
  // As on the web: no product for a new project, the only one without asking, else the one picked (or none).
  const engagementId =
    kind === "new_project" ? "" : products.length === 1 ? products[0].id : products.some((p) => p.id === chosenProduct) ? chosenProduct : "";
  const kindChoice = choices.data?.kinds.find((k) => k.value === kind);
  const preview = useQuery({
    queryKey: ["ticket-preview", companyId, engagementId, kind, kind === "problem" ? (impact ?? "other") : null],
    queryFn: () =>
      api.tickets.preview({
        companyId: companyId!,
        engagementId,
        kind: kind!,
        impact: kind === "problem" ? (impact ?? "other") : undefined,
      }),
    enabled: !!companyId && !!kind,
    placeholderData: keepPreviousData,
  });
  const expect = companyId && kind ? preview.data : undefined;
  const create = useMutation({
    mutationFn: () =>
      api.tickets.create({
        companyId: companyId!,
        engagementId,
        kind: kind!,
        impact: kind === "problem" ? impact : undefined,
        subject: subject.trim(),
        body: body.trim(),
        uploadIds: uploadIds(files),
      }),
    onSuccess: async ({ id }) => {
      haptic.success();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
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
  const sending = uploading(files);
  const ready = missing.length === 0 && !sending;
  const pick = [
    ...(companies.length > 1 ? ["a empresa"] : []),
    "o tipo",
    ...(kind === "problem" ? ["o impacto"] : []),
  ];
  const warning =
    missing.length === 0 && sending
      ? "Espere os anexos terminarem de enviar."
      : `Escolha ${list(pick)}${pick.length > 1 ? "," : ""} e preencha assunto e descrição.`;
  const submit = () => {
    // What was said is still on its way: opening now would leave it out.
    if (dictation.phase === "transcribing") return;
    if (ready) {
      if (dictation.busy) dictation.cancel();
      return create.mutate();
    }
    setTried(true);
    const where = positions.current;
    const block = missing[0];
    if (!block) return;
    // The two fields sit inside the padded block, so their offsets add to its own.
    const y = block === "subject" || block === "body" ? (where.fields ?? 0) + (where[block] ?? 0) : where[block];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - space.lg), animated: !reduceMotion });
  };
  const choose = (apply: () => void) => () => {
    haptic.select();
    apply();
  };
  const client = !me.data?.staff;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {linkedKind === "new_project" ? <Stack.Screen options={{ title: "Pedir orçamento" }} /> : null}
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: bottom + space.xl }}
      >
        {loading && <SkeletonRows count={5} />}
        {choices.error && (
          <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
            <Notice kind="error">{errorMessage(choices.error)}</Notice>
            <Button title="Tentar de novo" variant="secondary" size="small" onPress={() => void choices.refetch()} />
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
                        if (c.id !== companyId) {
                          setEngagement("");
                          setFiles([]);
                        }
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
            {kind === "change" && expect?.changeGuidance ? (
              <View style={{ paddingHorizontal: space.gutter }}>
                <Note icon="slider.horizontal.3">
                  <Text variant="subhead">{expect.changeGuidance}</Text>
                </Note>
              </View>
            ) : null}
            {products.length > 1 && kind !== "new_project" && (
              <Section header="Sobre o quê" footer="O produto, serviço ou projeto deste pedido." inset={space.gutter}>
                <ListRow
                  leading={<IconTile icon="square.grid.2x2" color="gray" />}
                  title="Não sei ou vale para todos"
                  trailing={engagementId === "" ? <Check /> : "none"}
                  accessibilityLabel={engagementId === "" ? "Não sei ou vale para todos, selecionado" : "Não sei ou vale para todos"}
                  accessibilityHint="Sobre o quê"
                  onPress={choose(() => setEngagement(""))}
                />
                {products.map((e) => (
                  <ListRow
                    key={e.id}
                    leading={<IconTile icon="globe" color="gray" />}
                    title={e.name}
                    trailing={engagementId === e.id ? <Check /> : "none"}
                    accessibilityLabel={engagementId === e.id ? `${e.name}, selecionado` : e.name}
                    accessibilityHint="Sobre o quê"
                    onPress={choose(() => setEngagement(e.id))}
                  />
                ))}
              </Section>
            )}
            <View onLayout={(e) => (positions.current.fields = e.nativeEvent.layout.y)} style={{ paddingHorizontal: space.gutter, gap: space.form }}>
              <View onLayout={(e) => (positions.current.subject = e.nativeEvent.layout.y)}>
                <Field
                  label="Assunto"
                  testID="subject"
                  placeholder="Um resumo em uma linha"
                  value={subject}
                  onChangeText={setSubject}
                  maxLength={160}
                  invalid={tried && !subject.trim()}
                />
              </View>
              {client && kind && kind !== "new_project" ? (
                <HelpSuggestions text={`${subject} ${body.slice(0, 200)}`} prefer={kind === "question"} />
              ) : null}
              <View onLayout={(e) => (positions.current.body = e.nativeEvent.layout.y)}>
                <Field
                  label="Descrição"
                  testID="body"
                  placeholder={kindChoice?.placeholder ?? "Descreva o que precisa."}
                  hint={PRIVACY}
                  value={body}
                  onChangeText={setBody}
                  maxLength={10000}
                  multiline
                  invalid={tried && !body.trim()}
                  style={{ minHeight: 140, paddingTop: space.md, textAlignVertical: "top" }}
                />
                <View style={{ marginTop: space.sm }}>
                  <DictationBar dictation={dictation} testID="body-mic" />
                </View>
              </View>
              {companyId ? <AttachmentField value={files} onChange={setFiles} target={{ kind: "ticket", companyId }} /> : null}
              {expect ? (
                <Note icon="clock" strong={expect.expect.dated}>
                  <Text variant="label">O que esperar</Text>
                  {expect.expect.lines.map((line) => (
                    <Text key={line} variant="subhead" tone={expect.expect.dated ? "foreground" : "muted"}>
                      {line}
                    </Text>
                  ))}
                  {expect.outOfHours ? (
                    <Text variant="subhead" tone="muted">
                      {expect.outOfHours}
                    </Text>
                  ) : null}
                </Note>
              ) : null}
              {client ? (
                <Text variant="caption" tone="muted">
                  Tarefa de projeto em andamento? Comente na própria tarefa.{" "}
                  <Text
                    variant="caption"
                    tone="primary"
                    accessibilityRole="link"
                    onPress={() => openHelp("tipos-de-chamado")}
                    style={{ color: palette.primary }}
                  >
                    Qual tipo escolher
                  </Text>
                </Text>
              ) : null}
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
