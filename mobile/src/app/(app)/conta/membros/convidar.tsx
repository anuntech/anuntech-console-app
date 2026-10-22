import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, Stack } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { ManagerGate } from "@/components/manager-gate";
import { ScopePicker } from "@/components/member-scope";
import { Segmented } from "@/components/segmented";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { showFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { membersKey, useMembers, type MemberScope, type Role } from "@/lib/manager";
import { HeaderIconButton } from "@/lib/stack";
import { space, usePalette } from "@/lib/theme";

const roles: Role[] = ["member", "manager"];
const roleHints: Record<Role, string> = {
  member: "Chamados, bookmarks e projetos.",
  manager: "Tudo, inclusive financeiro.",
};

/**
 * Inviting someone, as the web's InviteForm: an e-mail, a permission and, for
 * a Membro, optionally what they see. The invite e-mail goes out on its own.
 */
export default function InviteScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Convidar pessoa",
          presentation: "modal",
          headerLeft: () => <HeaderIconButton symbol="xmark" label="Cancelar" onPress={() => router.back()} />,
        }}
      />
      <ManagerGate>
        <InviteForm />
      </ManagerGate>
    </>
  );
}

function InviteForm() {
  const palette = usePalette();
  const queryClient = useQueryClient();
  const members = useMembers();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [choosing, setChoosing] = useState(false);
  const [scope, setScope] = useState<MemberScope>({ access: "selected", ids: [] });
  const invite = useMutation({
    mutationFn: () =>
      api.members.save({
        email: email.trim().toLowerCase(),
        role,
        // Without a choice the server gives a new Membro everything, as the web does.
        scope: role === "member" && choosing ? scope : undefined,
      }),
    onSuccess: ({ message }) => {
      haptic.success();
      showFlash(message);
      void queryClient.invalidateQueries({ queryKey: membersKey });
      router.back();
    },
    onError: () => haptic.error(),
  });
  const choices = members.data?.choices;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: space.xxl }}
      >
        <Field
          label="E-mail"
          testID="invite-email"
          placeholder="nome@empresa.com.br"
          value={email}
          onChangeText={(text) => {
            if (invite.isError) invite.reset();
            setEmail(text);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={254}
          autoFocus
          returnKeyType="done"
        />

        <View style={{ gap: space.sm }}>
          <Text variant="label" accessible={false}>
            Permissão
          </Text>
          <Segmented
            values={["Membro", "Administrador"]}
            selectedIndex={roles.indexOf(role)}
            accessibilityLabel="Permissão"
            onChange={(index) => setRole(roles[index] ?? "member")}
          />
          <Text variant="caption" tone="muted">
            {roleHints[role]}
          </Text>
        </View>

        {role === "member" ? (
          choosing && choices ? (
            <ScopePicker value={scope} onChange={setScope} choices={choices} />
          ) : (
            <View style={{ gap: space.xs }}>
              <Text variant="subhead" tone="muted">
                Um Membro vê todos os produtos, serviços e projetos da empresa.
              </Text>
              <Button
                title="Escolher o que ele vê"
                variant="plain"
                size="small"
                testID="choose-scope"
                disabled={!choices}
                onPress={() => {
                  haptic.select();
                  setChoosing(true);
                }}
              />
            </View>
          )
        ) : null}

        <View style={{ gap: space.md }}>
          {invite.error ? <Notice kind="error">{errorMessage(invite.error)}</Notice> : null}
          <Button
            title={invite.isPending ? "Convidando…" : "Convidar"}
            icon="paperplane.fill"
            testID="send-invite"
            busy={invite.isPending}
            disabled={!email.trim()}
            onPress={() => invite.mutate()}
          />
          <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
            A pessoa recebe um e-mail para entrar e aparece em Membros como convidada até o primeiro acesso.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
