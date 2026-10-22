import { ActivityIndicator, Alert, FlatList, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Notice, Row } from "@/components/surface";
import { Text } from "@/components/text";
import { listConversations, removeConversation } from "@/lib/assistant";
import { when } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { space } from "@/lib/theme";

/** The person's earlier conversations: tap to continue, hold to delete. */
export default function Conversations() {
  const bottom = useTabBarSpace();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["assistant-conversations"], queryFn: listConversations });
  const remove = useMutation({
    mutationFn: removeConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] }),
    onError: () => Alert.alert("Não foi possível excluir", "Confira a internet e tente de novo."),
  });
  return (
    <FlatList
      data={list.data ?? []}
      keyExtractor={(c) => c.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.lg, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      ListHeaderComponent={list.error ? <Notice kind="error">{list.error.message}</Notice> : undefined}
      ListEmptyComponent={
        list.isPending ? (
          <ActivityIndicator accessibilityLabel="Carregando" />
        ) : !list.error ? (
          <Text tone="muted" style={{ textAlign: "center", marginTop: space.block }}>
            Nenhuma conversa ainda.
          </Text>
        ) : undefined
      }
      renderItem={({ item }) => (
        <Row
          title={item.title}
          detail={`${when(item.updatedAt)} · ${item.messages} mensage${item.messages === 1 ? "m" : "ns"}`}
          onPress={() => router.navigate({ pathname: "/assistente" as never, params: { conversa: item.id } })}
          onLongPress={() =>
            Alert.alert("Excluir conversa?", item.title, [
              { text: "Cancelar", style: "cancel" },
              { text: "Excluir", style: "destructive", onPress: () => remove.mutate(item.id) },
            ])
          }
        />
      )}
    />
  );
}
