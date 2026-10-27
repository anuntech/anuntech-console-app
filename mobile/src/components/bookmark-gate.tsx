import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
import { ORPCError } from "@orpc/client";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "@/components/manager-gate";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { useBookmark, type Bookmark } from "@/lib/bookmarks";
import { space } from "@/lib/theme";

/**
 * The bookmark an edit or move screen works on, with or without the list
 * loaded: a skeleton while it comes, "não encontrado" when it is gone or the
 * person cannot change it, and a retry when the connection fails.
 */
export function BookmarkGate({ id, children }: { id: string; children: (item: Bookmark) => ReactNode }) {
  const query = useBookmark(id);
  const loading = useDelayed(query.isPending);
  const item = query.data;
  if (item?.editable) return children(item);
  const gone = item || !id || (query.error instanceof ORPCError && query.error.status === 404);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: space.sm }}>
      {gone ? (
        <EmptyState
          icon="bookmark.slash"
          title="Item não encontrado"
          text="Ele pode ter sido excluído ou você não pode alterá-lo. Volte para a lista."
          action={
            router.canGoBack()
              ? { label: "Voltar", onPress: () => router.back() }
              : { label: "Ver arquivos", onPress: () => router.replace("/bookmarks") }
          }
        />
      ) : query.error ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : loading ? (
        <SkeletonRows count={3} />
      ) : null}
    </ScrollView>
  );
}
