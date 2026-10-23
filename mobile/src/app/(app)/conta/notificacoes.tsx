import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { Stack, router } from "expo-router";
import { SymbolView } from "@/components/symbol";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { FormSkeleton, LoadError, ManagerGate } from "@/components/manager-gate";
import { Section } from "@/components/section";
import { useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { formatPhoneInput, phoneDigits } from "@/lib/br-input";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { notificationsKey } from "@/lib/manager";
import { fonts, space, usePalette } from "@/lib/theme";

type Topic = Awaited<ReturnType<typeof api.notifications.get>>["topics"][number];
type Kind = "email" | "phone";
type Contact = { id: number; value: string };

const LIMIT = 10;
let sequence = 0;
const contact = (value: string): Contact => ({ id: ++sequence, value });
/** At least one line to type in, as on the web. */
const rows = (values: string[], kind: Kind) =>
  (values.length ? values : [""]).map((value) => contact(kind === "phone" ? phoneDigits(value) : value));

const words = {
  email: { one: "E-mail", many: "E-mails", add: "Adicionar e-mail", placeholder: "nome@empresa.com.br" },
  phone: { one: "Telefone", many: "Telefones", add: "Adicionar telefone", placeholder: "(11) 99999-9999" },
} as const;

/** Who receives the company's notices, per subject, as Configurações > Notificações on the web. */
export default function NotificationsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Notificações" }} />
      <ManagerGate>
        <Notifications />
      </ManagerGate>
    </>
  );
}

function Notifications() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const query = useQuery({ queryKey: notificationsKey, queryFn: () => api.notifications.get({}) });
  const loading = useDelayed(query.isPending);
  const topics = query.data?.topics ?? [];
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.gutter, gap: space.xl, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
      >
        <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.xs }}>
          Quem recebe os avisos da empresa, por assunto, por e-mail e WhatsApp.
        </Text>
        {query.isPending && loading ? <FormSkeleton fields={4} /> : null}
        {query.error && !query.data ? <LoadError error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && topics.length === 0 ? (
          <EmptyState icon="bell.slash" title="Nenhum assunto" text="Não há avisos para configurar nesta empresa." />
        ) : null}
        {topics.map((topic) => (
          <TopicForm key={topic.topic} topic={topic} />
        ))}
        {query.data ? (
          <Section footer="O que saiu por e-mail e WhatsApp, com a situação de cada envio.">
            <ListRow
              testID="row-notice-history"
              title="Histórico de envios"
              leading={<IconTile icon="clock.arrow.circlepath" color="gray" />}
              onPress={() => router.push("/conta/envios" as never)}
            />
          </Section>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** One subject (Financeiro, Chamados): its channels and destinations, saved on their own. */
function TopicForm({ topic }: { topic: Topic }) {
  const queryClient = useQueryClient();
  const [emailEnabled, setEmailEnabled] = useState(topic.emailEnabled);
  const [whatsappEnabled, setWhatsappEnabled] = useState(topic.whatsappEnabled);
  const [emails, setEmails] = useState(() => rows(topic.emails, "email"));
  const [phones, setPhones] = useState(() => rows(topic.phones, "phone"));
  const save = useMutation({
    mutationFn: () =>
      api.notifications.save({
        topic: topic.topic,
        // Empty lines are ignored, as on the web; the server validates the rest.
        emails: emails.map((e) => e.value.trim()).filter(Boolean),
        phones: phones.map((p) => p.value).filter(Boolean),
        emailEnabled,
        whatsappEnabled,
      }),
    onSuccess: async () => {
      haptic.success();
      await queryClient.invalidateQueries({ queryKey: notificationsKey });
    },
    onError: () => haptic.error(),
  });
  const touched = () => {
    if (save.isSuccess || save.isError) save.reset();
  };
  const toggle = (set: (on: boolean) => void) => (on: boolean) => {
    touched();
    haptic.select();
    set(on);
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 2, marginHorizontal: space.xs }}>
        <Text variant="heading" accessibilityRole="header">
          {topic.title}
        </Text>
        <Text variant="subhead" tone="muted">
          {topic.description}
        </Text>
      </View>

      <Section header="Receber por">
        <SwitchRow
          title="Receber por e-mail"
          icon="envelope.fill"
          color="violet"
          value={emailEnabled}
          testID={`notify-email-${topic.topic}`}
          onChange={toggle(setEmailEnabled)}
        />
        <SwitchRow
          title="Receber por WhatsApp"
          icon="message.fill"
          color="green"
          value={whatsappEnabled}
          testID={`notify-whatsapp-${topic.topic}`}
          onChange={toggle(setWhatsappEnabled)}
        />
      </Section>

      <ContactList
        kind="email"
        topic={topic.topic}
        contacts={emails}
        onChange={(next) => {
          touched();
          setEmails(next);
        }}
      />
      <ContactList
        kind="phone"
        topic={topic.topic}
        contacts={phones}
        onChange={(next) => {
          touched();
          setPhones(next);
        }}
        footer="Vale para os próximos envios."
      />

      {save.data ? <Notice kind="success">{save.data.message}</Notice> : null}
      {save.error ? <Notice kind="error">{errorMessage(save.error)}</Notice> : null}
      <Button
        title={save.isPending ? "Salvando…" : "Salvar"}
        accessibilityLabel={`Salvar ${topic.title}`}
        testID={`save-notifications-${topic.topic}`}
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
    </View>
  );
}

/** A channel's switch on a Settings row; VoiceOver hears one switch with its state. */
function SwitchRow({
  title,
  icon,
  color,
  value,
  onChange,
  testID,
}: {
  title: string;
  icon: "envelope.fill" | "message.fill";
  color: "violet" | "green";
  value: boolean;
  onChange: (on: boolean) => void;
  testID: string;
}) {
  const palette = usePalette();
  return (
    <View
      accessible
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value }}
      onAccessibilityTap={() => onChange(!value)}
    >
      <ListRow
        title={title}
        leading={<IconTile icon={icon} color={color} />}
        trailing={<Switch testID={testID} value={value} trackColor={{ true: palette.primary }} onValueChange={onChange} />}
      />
    </View>
  );
}

/** Up to ten addresses or numbers: a line each, removable, and a row to add one more. */
function ContactList({
  kind,
  topic,
  contacts,
  onChange,
  footer,
}: {
  kind: Kind;
  topic: Topic["topic"];
  contacts: Contact[];
  onChange: (next: Contact[]) => void;
  footer?: string;
}) {
  const palette = usePalette();
  const w = words[kind];
  const [focus, setFocus] = useState<number | null>(null);
  const edit = (id: number, text: string) =>
    onChange(contacts.map((c) => (c.id === id ? { ...c, value: kind === "phone" ? phoneDigits(text).slice(0, 11) : text } : c)));
  const remove = (id: number) => {
    haptic.light();
    // The last line empties instead of going away, so there is always one to type in.
    onChange(contacts.length === 1 ? [contact("")] : contacts.filter((c) => c.id !== id));
  };
  const add = () => {
    haptic.light();
    const next = contact("");
    setFocus(next.id);
    onChange([...contacts, next]);
  };
  return (
    <Section header={w.many} footer={footer} indent={space.lg}>
      {contacts.map((c, index) => (
        <View key={c.id} style={{ minHeight: space.row, flexDirection: "row", alignItems: "center", paddingLeft: space.lg, paddingRight: space.sm }}>
          <TextInput
            testID={`${kind}-${topic}-${index}`}
            accessibilityLabel={`${w.one} ${index + 1}`}
            value={kind === "phone" ? formatPhoneInput(c.value) : c.value}
            onChangeText={(text) => edit(c.id, text)}
            placeholder={w.placeholder}
            placeholderTextColor={palette.muted}
            autoFocus={focus === c.id}
            keyboardType={kind === "email" ? "email-address" : "phone-pad"}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            maxLength={kind === "email" ? 254 : 16}
            maxFontSizeMultiplier={2}
            style={{
              flex: 1,
              minHeight: space.touch,
              fontFamily: fonts.regular,
              fontSize: 17,
              color: palette.foreground,
              letterSpacing: 0,
              textAlign: "left",
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remover ${w.one.toLowerCase()} ${index + 1}`}
            hitSlop={8}
            onPress={() => remove(c.id)}
            style={{ width: space.touch, height: space.touch, alignItems: "center", justifyContent: "center" }}
          >
            <SymbolView name="minus.circle.fill" size={22} tintColor={palette.destructive} accessible={false} />
          </Pressable>
        </View>
      ))}
      {contacts.length < LIMIT ? (
        <ListRow
          testID={`add-${kind}-${topic}`}
          title={w.add}
          tone="primary"
          leading={<SymbolView name="plus.circle.fill" size={22} tintColor={palette.success} accessible={false} />}
          trailing="none"
          onPress={add}
        />
      ) : null}
    </Section>
  );
}
