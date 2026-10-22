import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { SymbolView } from "expo-symbols";
import { Avatar } from "@/components/avatar";
import { Notice } from "@/components/surface";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { Bar, useDelayed } from "@/components/skeleton";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { useMe } from "@/lib/me";
import { errorMessage } from "@/lib/api";
import { formatPhone } from "@/lib/config";
import { haptic } from "@/lib/haptics";
import { confirmIdentity, lockAvailable, lockEnabled, setLockEnabled } from "@/lib/lock";
import { signOut } from "@/lib/session";
import { useTabBarSpace } from "@/lib/layout";
import { rounded, space, usePalette } from "@/lib/theme";

const roles = { manager: "Administrador", member: "Membro" } as const;

/** The profile card while me.get loads. */
function HeaderSkeleton() {
  const palette = usePalette();
  return (
    <View
      accessible
      accessibilityLabel="Carregando"
      style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: space.lg, backgroundColor: palette.card, ...rounded(24) }}
    >
      <Bar width={60} height={60} radius={30} />
      <View style={{ flex: 1, gap: 8 }}>
        <Bar width="55%" height={20} />
        <Bar width="75%" height={14} />
      </View>
    </View>
  );
}

/**
 * Conta, the person's settings, as Minha conta and Segurança on the web:
 * profile, contacts, two-step and sessions; the company's pages for its
 * Administrador; the Face ID lock, sign out and account deletion.
 */
export default function Account() {
  const palette = usePalette();
  const me = useMe();
  const bottom = useTabBarSpace();
  const loading = useDelayed(me.isPending);
  const [canLock, setCanLock] = useState(false);
  const [locked, setLocked] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    void lockAvailable().then(setCanLock);
    void lockEnabled().then(setLocked);
  }, []);
  const companies = me.data?.companies ?? [];
  const where = me.data?.staff
    ? "Equipe da Anuntech"
    : companies.length === 1
      ? `${roles[companies[0].role]} · ${companies[0].name}`
      : companies.length > 1
        ? `${companies.length} empresas`
        : null;
  const phone = me.data?.phone ? `WhatsApp ${formatPhone(me.data.phone)}` : null;

  async function toggleLock(next: boolean) {
    if (next && !(await confirmIdentity("Ativar o Face ID no Console"))) return;
    await setLockEnabled(next);
    setLocked(next);
    if (next) haptic.success();
  }
  function leave() {
    Alert.alert("Sair do Console?", undefined, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          setLeaving(true);
          void signOut().finally(() => setLeaving(false));
        },
      },
    ]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      style={{ backgroundColor: palette.background }}
      refreshControl={<RefreshControl refreshing={me.isRefetching} onRefresh={() => void me.refetch()} />}
    >
      {me.error && <Notice kind="error">{errorMessage(me.error)}</Notice>}
      {loading ? <HeaderSkeleton /> : null}
      {me.data && (
        <Section>
          <Pressable
            testID="profile-card"
            accessibilityRole="button"
            accessibilityLabel={[me.data.name, me.data.email, phone, where].filter(Boolean).join(", ")}
            accessibilityHint="Abre o perfil"
            onPress={() => router.push("/conta/perfil")}
            android_ripple={{ color: palette.fill }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              padding: space.lg,
              gap: 14,
              backgroundColor: pressed ? palette.fill : "transparent",
            })}
          >
            <Avatar avatar={me.data.avatar} name={me.data.name} email={me.data.email} size={60} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{me.data.name}</Text>
              <Text variant="subhead" tone="muted">
                {me.data.email}
              </Text>
              {phone ? (
                <Text variant="subhead" tone="muted">
                  {phone}
                </Text>
              ) : null}
              {where ? (
                <Text variant="caption" tone="muted">
                  {where}
                </Text>
              ) : null}
            </View>
            <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={palette.tertiary} accessible={false} />
          </Pressable>
        </Section>
      )}
      <Section header="Minha conta">
        <ListRow
          testID="row-profile"
          title="Perfil"
          subtitle="Foto e nome"
          leading={<IconTile icon="person.crop.circle.fill" color="violet" />}
          onPress={() => router.push("/conta/perfil")}
        />
        <ListRow
          testID="row-contacts"
          title="Contatos de acesso"
          subtitle="E-mail e WhatsApp"
          leading={<IconTile icon="envelope.fill" color="teal" />}
          onPress={() => router.push("/conta/contatos")}
        />
        <ListRow
          testID="row-security"
          title="Segurança"
          subtitle="Verificação em duas etapas e sessões"
          value={me.data ? (me.data.twoFactorEnabled ? "Ativada" : "Desativada") : undefined}
          leading={<IconTile icon="lock.shield.fill" color="green" />}
          onPress={() => router.push("/conta/seguranca")}
        />
      </Section>
      {me.data?.managedCompanyId ? (
        <Section header="Empresa">
          <ListRow
            testID="row-company"
            title="Dados da empresa"
            leading={<IconTile icon="building.2.fill" color="ink" />}
            onPress={() => router.push("/conta/empresa")}
          />
          <ListRow
            testID="row-members"
            title="Membros"
            leading={<IconTile icon="person.2.fill" color="violet" />}
            onPress={() => router.push("/conta/membros")}
          />
          <ListRow
            testID="row-notifications"
            title="Notificações"
            leading={<IconTile icon="bell.fill" color="red" />}
            onPress={() => router.push("/conta/notificacoes")}
          />
        </Section>
      ) : null}
      {canLock && (
        <Section footer="Pede o Face ID ao abrir o app e depois de 5 minutos fora dele.">
          <View
            accessible
            accessibilityRole="switch"
            accessibilityLabel="Travar com Face ID"
            accessibilityState={{ checked: locked }}
            onAccessibilityTap={() => void toggleLock(!locked)}
          >
            <ListRow
              title="Travar com Face ID"
              leading={<IconTile icon="faceid" color="green" />}
              trailing={
                <Switch
                  value={locked}
                  trackColor={{ true: palette.primary }}
                  onValueChange={(next) => void toggleLock(next)}
                />
              }
            />
          </View>
        </Section>
      )}
      <Section>
        <ListRow
          testID="sign-out"
          title={leaving ? "Saindo…" : "Sair"}
          leading={<IconTile icon="rectangle.portrait.and.arrow.right" color="gray" />}
          trailing="none"
          onPress={leaving ? undefined : leave}
        />
      </Section>
      <Section footer="Apaga seus dados pessoais. Chamados e faturas ficam com a empresa.">
        <ListRow
          testID="delete-account-row"
          title="Excluir minha conta"
          tone="destructive"
          leading={<IconTile icon="trash.fill" color="red" />}
          onPress={() => {
            if (me.data?.owner)
              Alert.alert(
                "Não é possível excluir",
                "A conta do proprietário do Console não pode ser excluída. Transfira a administração antes.",
              );
            else router.push("/conta/excluir");
          }}
        />
      </Section>
      <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
        Console da Anuntech · versão {Constants.expoConfig?.version}
      </Text>
    </ScrollView>
  );
}
