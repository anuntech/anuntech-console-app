import { useRef } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { GroupSeparator, groupedItem } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { listConversations, removeConversation, type Conversation } from "@/lib/assistant";
import { when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { space, usePalette } from "@/lib/theme";

/** The person's earlier conversations: tap to continue; swipe, hold or the VoiceOver action to delete. */
export default function Conversations() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["assistant-conversations"], queryFn: listConversations });
  const loading = useDelayed(list.isPending, 150);
  const remove = useMutation({
    mutationFn: removeConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] }),
    onError: () => {
      haptic.error();
      Alert.alert("Não foi possível excluir", "Confira a internet e tente de novo.");
    },
  });
  const items = list.data ?? [];
  return (
    // The swipe needs a gesture root; the app's root layout does not have one yet.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: space.lg, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        ListHeaderComponent={
          list.error ? (
            <View style={{ marginHorizontal: space.gutter, marginBottom: space.lg }}>
              <Notice kind="error">{list.error.message}</Notice>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          list.isPending ? (
            loading ? (
              <SkeletonRows />
            ) : undefined
          ) : !list.error ? (
            <EmptyState icon="sparkles" title="Nenhuma conversa ainda" text="Suas conversas com o assistente ficam guardadas aqui." />
          ) : undefined
        }
        ItemSeparatorComponent={GroupSeparator}
        renderItem={({ item, index }) => (
          <View style={groupedItem(palette, index, items.length)}>
            <ConversationRow conversation={item} onDelete={() => remove.mutate(item.id)} />
          </View>
        )}
      />
    </GestureHandlerRootView>
  );
}

function ConversationRow({ conversation: c, onDelete }: { conversation: Conversation; onDelete: () => void }) {
  const palette = usePalette();
  const swipe = useRef<SwipeableMethods>(null);
  const count = `${c.messages} mensage${c.messages === 1 ? "m" : "ns"}`;
  const detail = `${when(c.updatedAt)} · ${count}`;
  const confirm = () =>
    Alert.alert("Excluir conversa?", c.title, [
      { text: "Cancelar", style: "cancel", onPress: () => swipe.current?.close() },
      { text: "Excluir", style: "destructive", onPress: onDelete },
    ]);
  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      rightThreshold={44}
      overshootRight={false}
      onSwipeableWillOpen={confirm}
      renderRightActions={() => (
        <View
          accessible={false}
          style={{ width: 88, backgroundColor: palette.destructiveSolid, alignItems: "center", justifyContent: "center", gap: 4 }}
        >
          <SymbolView name="trash.fill" size={17} tintColor={palette.onDestructive} accessible={false} />
          <Text variant="micro" style={{ color: palette.onDestructive }}>
            Excluir
          </Text>
        </View>
      )}
      childrenContainerStyle={{ backgroundColor: palette.card }}
    >
      <ListRow
        title={
          <Text numberOfLines={1}>
            {c.title}
          </Text>
        }
        subtitle={
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {detail}
          </Text>
        }
        leading={
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: palette.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView name="bubble.left.fill" size={14} tintColor={palette.primary} accessible={false} />
          </View>
        }
        accessibilityLabel={`${c.title}, ${detail}`}
        accessibilityHint="Abre a conversa"
        accessibilityActions={[{ name: "delete", label: "Excluir conversa" }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "delete") confirm();
        }}
        onPress={() => router.navigate({ pathname: "/assistente" as never, params: { conversa: c.id } })}
        onLongPress={() => {
          haptic.light();
          confirm();
        }}
      />
    </ReanimatedSwipeable>
  );
}
