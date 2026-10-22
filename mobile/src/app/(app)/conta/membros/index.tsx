import { useEffect } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { router, Stack } from "expo-router";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { LoadError, ManagerGate } from "@/components/manager-gate";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { PersonMeta, personLabel } from "@/components/member-row";
import { clearFlash, useFlash } from "@/lib/flash";
import { useTabBarSpace } from "@/lib/layout";
import { managerRoutes, useMembers } from "@/lib/manager";
import { HeaderIconButton } from "@/lib/stack";
import { space, usePalette } from "@/lib/theme";

/** Who enters the Console for the company, as Configurações > Membros on the web. */
export default function MembersScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Membros" }} />
      <ManagerGate>
        <Members />
      </ManagerGate>
    </>
  );
}

function Members() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const members = useMembers();
  const flash = useFlash();
  const loading = useDelayed(members.isPending);
  // The answer to an invite or a removal stays while the list is open, not after.
  useEffect(() => () => clearFlash(), []);
  const people = members.data?.people ?? [];
  const invite = () => {
    clearFlash();
    router.push(managerRoutes.invite);
  };
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => <HeaderIconButton symbol="person.badge.plus" label="Convidar" testID="invite-member" onPress={invite} />,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: palette.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={<RefreshControl refreshing={members.isRefetching} onRefresh={() => void members.refetch()} />}
      >
        <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.xs }}>
          Quem entra no Console em nome da sua empresa e o que cada pessoa pode fazer.
        </Text>
        {flash ? <Notice kind="success">{flash.text}</Notice> : null}
        {members.isPending && loading ? <SkeletonRows count={4} inset={0} /> : null}
        {members.error && !members.data ? <LoadError error={members.error} onRetry={() => void members.refetch()} /> : null}
        {members.error && members.data ? <Notice kind="error">Não foi possível atualizar a lista. Puxe para tentar de novo.</Notice> : null}
        {members.data && people.length === 0 ? (
          <EmptyState
            icon="person.2"
            title="Ninguém por aqui ainda"
            text="Convide quem entra no Console em nome da empresa."
            action={{ label: "Convidar", icon: "person.badge.plus", onPress: invite }}
          />
        ) : null}
        {people.length > 0 ? (
          <Section
            header="Pessoas da empresa"
            footer="A pessoa recebe um e-mail para entrar e aparece aqui como convidada até o primeiro acesso."
            indent={68}
          >
            {people.map((person) => (
              <ListRow
                key={person.key}
                testID={`member-${person.email}`}
                leading={<Avatar avatar={person.avatar} name={person.name} email={person.email} size={40} />}
                title={person.name ?? person.email}
                subtitle={person.name ? person.email : undefined}
                meta={<PersonMeta person={person} />}
                accessibilityLabel={personLabel(person)}
                accessibilityHint={person.self ? undefined : "Abre o acesso desta pessoa"}
                trailing={person.self ? "none" : "chevron"}
                onPress={person.self ? undefined : () => router.push(managerRoutes.person(person.key))}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}
