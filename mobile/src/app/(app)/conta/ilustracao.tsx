import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { Avatar } from "@/components/avatar";
import { Bar, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { showAvatar } from "@/lib/profile";
import { space, usePalette } from "@/lib/theme";

const COLUMNS = 4;

/** "Escolher avatar" of the web: one of the Console's illustrations for the profile. */
export default function Illustration() {
  const palette = usePalette();
  const me = useMe();
  const bottom = useTabBarSpace();
  const { width } = useWindowDimensions();
  const catalog = useQuery({ queryKey: ["avatars"], queryFn: () => api.profile.avatars({}), staleTime: Infinity });
  const loading = useDelayed(catalog.isPending);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const cell = Math.floor((width - space.gutter * 2 - space.md * (COLUMNS - 1)) / COLUMNS);
  const size = Math.min(cell - 8, 80);
  const current = me.data?.avatar?.kind === "illustration" ? me.data.avatar.path : null;

  async function choose(image: string) {
    if (saving) return;
    setSaving(image);
    setError("");
    try {
      const result = await api.profile.setAvatar({ image });
      showAvatar(result.avatar);
      haptic.success();
      router.back();
    } catch (failure) {
      haptic.error();
      setError(errorMessage(failure));
    } finally {
      setSaving(null);
    }
  }

  const header = (
    <View style={{ gap: space.md, marginBottom: space.lg }}>
      <Text tone="muted">Uma ilustração para o seu perfil.</Text>
      {catalog.error ? <Notice kind="error">{errorMessage(catalog.error)}</Notice> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      {loading ? (
        <View accessible accessibilityLabel="Carregando" style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={{ width: cell, alignItems: "center" }}>
              <Bar width={size} height={size} radius={size / 2} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={catalog.data?.avatars ?? []}
      keyExtractor={(item) => item.image}
      numColumns={COLUMNS}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{ padding: space.gutter, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      columnWrapperStyle={{ gap: space.md }}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      ListHeaderComponent={header}
      renderItem={({ item, index }) => {
        const selected = current === item.path;
        return (
          <Pressable
            testID={`avatar-option-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`Ilustração ${index + 1}`}
            accessibilityState={{ selected, disabled: !!saving, busy: saving === item.image }}
            disabled={!!saving}
            onPress={() => void choose(item.image)}
            style={({ pressed }) => ({ width: cell, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
          >
            <View
              style={{
                padding: 3,
                borderRadius: size,
                borderWidth: 2,
                borderColor: selected ? palette.primary : "transparent",
              }}
            >
              <Avatar avatar={{ kind: "illustration", path: item.path, color: item.color }} size={size} />
              {saving === item.image ? (
                <View
                  style={{
                    position: "absolute",
                    inset: 3,
                    borderRadius: size / 2,
                    backgroundColor: "rgba(0,0,0,0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color="#ffffff" />
                </View>
              ) : null}
              {selected ? (
                <View
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: palette.primary,
                    borderWidth: 2,
                    borderColor: palette.background,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SymbolView name="checkmark" size={11} weight="bold" tintColor={palette.primaryForeground} accessible={false} />
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}
