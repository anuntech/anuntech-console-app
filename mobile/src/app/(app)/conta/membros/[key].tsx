import { useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { LoadError, ManagerGate } from "@/components/manager-gate";
import { PersonMeta } from "@/components/member-row";
import { ScopePicker } from "@/components/member-scope";
import { Section } from "@/components/section";
import { SkeletonHeader, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { showFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { membersKey, useMembers, type MemberScope, type Person, type Role, type ScopeChoice } from "@/lib/manager";
import { space, usePalette } from "@/lib/theme";

const roleNames: Record<Role, string> = { manager: "Administrador", member: "Membro" };
type Answer = { kind: "success" | "error"; text: string; where: "access" | "scope" | "invite" };

/** One person of the company: their access and what the web lets an Administrador do with it. */
export default function PersonScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <ManagerGate>
        <PersonLoader personKey={key ?? ""} />
      </ManagerGate>
    </>
  );
}

function PersonLoader({ personKey }: { personKey: string }) {
  const palette = usePalette();
  const members = useMembers();
  const loading = useDelayed(members.isPending);
  const person = members.data?.people.find((p) => p.key === personKey);
  if (person && members.data) return <PersonDetail person={person} choices={members.data.choices} />;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block }}
    >
      {members.isPending && loading ? <SkeletonHeader /> : null}
      {members.error && !members.data ? <LoadError error={members.error} onRetry={() => void members.refetch()} /> : null}
      {members.data ? (
        <EmptyState
          icon="person.crop.circle.badge.questionmark"
          title="Pessoa não encontrada"
          text="O acesso pode ter sido removido. Volte para a lista de Membros."
          action={router.canGoBack() ? { label: "Voltar", onPress: () => router.back() } : undefined}
        />
      ) : null}
    </ScrollView>
  );
}

function PersonDetail({ person, choices }: { person: Person; choices: ScopeChoice[] }) {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: membersKey });
  const failed = (where: Answer["where"]) => (error: unknown) => {
    haptic.error();
    setAnswer({ kind: "error", text: errorMessage(error), where });
  };
  const succeeded = (where: Answer["where"]) => async ({ message }: { message: string }) => {
    haptic.success();
    setAnswer({ kind: "success", text: message, where });
    await refresh();
  };

  const changeRole = useMutation({
    mutationFn: (role: Role) => api.members.save({ email: person.email, role }),
    onSuccess: succeeded("access"),
    onError: failed("access"),
  });
  const saveScope = useMutation({
    mutationFn: (scope: MemberScope) => api.members.save({ email: person.email, role: "member", scope }),
    onSuccess: succeeded("scope"),
    onError: failed("scope"),
  });
  const resend = useMutation({
    mutationFn: () => api.members.resendInvite({ memberId: person.memberId }),
    onSuccess: succeeded("invite"),
    onError: failed("invite"),
  });
  const revoke = useMutation({
    mutationFn: () => api.members.revoke({ memberId: person.memberId }),
    onSuccess: ({ message }) => {
      haptic.success();
      // The person leaves the list: the answer goes with it, shown where the list is.
      showFlash(message);
      router.back();
      void refresh();
    },
    onError: failed("invite"),
  });
  const busy = changeRole.isPending || saveScope.isPending || resend.isPending || revoke.isPending;

  const target: Role = person.role === "manager" ? "member" : "manager";
  const askRole = () => {
    haptic.light();
    Alert.alert(
      `Mudar para ${roleNames[target]}?`,
      target === "manager"
        ? `${person.email} passa a ver tudo da empresa, inclusive o financeiro, e a cuidar dos Membros.`
        : `${person.email} passa a ver só chamados, bookmarks e projetos, sem o financeiro.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Mudar", onPress: () => changeRole.mutate(target) },
      ],
    );
  };
  const askResend = () => {
    haptic.light();
    Alert.alert(
      "Reenviar o convite?",
      `${person.email} ainda não entrou. Um novo convite sai agora; dá para reenviar uma vez por semana.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Reenviar", onPress: () => resend.mutate() },
      ],
    );
  };
  const askRevoke = () => {
    haptic.medium();
    Alert.alert(
      person.pending ? "Cancelar este convite?" : "Remover este acesso?",
      person.pending
        ? `${person.email} não poderá mais entrar com este convite.`
        : `${person.email} perde o acesso ao ambiente. Os registros são preservados.`,
      [
        // "Voltar", not "Cancelar": next to "Cancelar convite" the word would mean both things.
        { text: "Voltar", style: "cancel" },
        { text: person.pending ? "Cancelar convite" : "Remover acesso", style: "destructive", onPress: () => revoke.mutate() },
      ],
    );
  };
  const spinner = (on: boolean) => (on ? <ActivityIndicator size="small" color={palette.muted} /> : "none");
  const notice = (where: Answer["where"]) =>
    answer?.where === where ? <Notice kind={answer.kind}>{answer.text}</Notice> : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
    >
      <View
        accessible
        accessibilityLabel={[person.name ?? person.email, person.name ? person.email : null, person.roleLabel, person.statusLabel]
          .filter(Boolean)
          .join(", ")}
        style={{ alignItems: "center", gap: space.sm }}
      >
        <Avatar avatar={person.avatar} name={person.name} email={person.email} size={72} />
        <Text variant="title" style={{ textAlign: "center" }} accessibilityRole="header">
          {person.name ?? person.email}
        </Text>
        {person.name ? (
          <Text variant="subhead" tone="muted" style={{ textAlign: "center" }}>
            {person.email}
          </Text>
        ) : null}
        <View style={{ alignItems: "center" }}>
          <PersonMeta person={person} />
        </View>
        {!person.pending ? (
          <Text variant="caption" tone="muted">
            {person.statusLabel}
          </Text>
        ) : null}
      </View>

      {person.self ? (
        <Notice kind="info">Este é o seu acesso. Para mudá-lo, peça a outro Administrador da empresa.</Notice>
      ) : (
        <>
          {!person.pending ? (
            <View style={{ gap: space.md }}>
              <Section header="Permissão" footer="Membro: chamados, bookmarks e projetos. Administrador: tudo, inclusive financeiro.">
                <ListRow
                  testID="change-role"
                  leading={<IconTile icon="checkmark.shield.fill" color="violet" />}
                  title={`Mudar para ${roleNames[target]}`}
                  subtitle={`Hoje é ${person.roleLabel}`}
                  trailing={spinner(changeRole.isPending)}
                  onPress={busy ? undefined : askRole}
                />
              </Section>
              {notice("access")}
            </View>
          ) : null}

          {person.role === "member" ? (
            <ScopeEditor
              key={`${person.scope.access}:${person.scope.ids.join(",")}`}
              scope={person.scope}
              choices={choices}
              saving={saveScope.isPending}
              disabled={busy}
              onSave={(scope) => saveScope.mutate(scope)}
              answer={notice("scope")}
            />
          ) : null}

          <View style={{ gap: space.md }}>
            <Section header={person.pending ? "Convite" : "Acesso"}>
              {person.pending ? (
                <ListRow
                  testID="resend-invite"
                  leading={<IconTile icon="envelope.fill" color="teal" />}
                  title="Reenviar convite"
                  subtitle="Uma vez por semana"
                  trailing={spinner(resend.isPending)}
                  onPress={busy ? undefined : askResend}
                />
              ) : null}
              <ListRow
                testID="revoke-member"
                tone="destructive"
                leading={<IconTile icon="person.crop.circle.badge.xmark" color="red" />}
                title={person.pending ? "Cancelar convite" : "Remover acesso"}
                trailing={spinner(revoke.isPending)}
                onPress={busy ? undefined : askRevoke}
              />
            </Section>
            {notice("invite")}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** What a Membro sees: a draft of the choice, saved with its own button. */
function ScopeEditor({
  scope,
  choices,
  saving,
  disabled,
  onSave,
  answer,
}: {
  scope: MemberScope;
  choices: ScopeChoice[];
  saving: boolean;
  disabled: boolean;
  onSave: (scope: MemberScope) => void;
  answer: ReactNode;
}) {
  const [draft, setDraft] = useState<MemberScope>(scope);
  const same =
    draft.access === scope.access &&
    (draft.access === "all" || (draft.ids.length === scope.ids.length && draft.ids.every((id) => scope.ids.includes(id))));
  return (
    <View style={{ gap: space.md }}>
      <ScopePicker value={draft} onChange={setDraft} choices={choices} />
      {answer}
      {!same || saving ? (
        <Button
          title={saving ? "Salvando…" : "Salvar o que esta pessoa vê"}
          testID="save-scope"
          busy={saving}
          disabled={disabled && !saving}
          onPress={() => onSave(draft.access === "all" ? { access: "all", ids: [] } : draft)}
        />
      ) : null}
    </View>
  );
}
