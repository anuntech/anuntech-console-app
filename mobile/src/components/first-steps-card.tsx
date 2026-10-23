import { useCallback } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SymbolView } from "@/components/symbol";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { followHelpLink, useAppReach } from "@/lib/help-routes";
import { space, usePalette } from "@/lib/theme";
import { Button } from "./button";
import { ListRow } from "./list-row";
import { Section } from "./section";
import { Text } from "./text";

/**
 * "Primeiros passos" (guide.firstSteps): the few things a person does once to
 * work well with Anuntech; Administradores and Membros get different steps.
 * Self-contained for Início: it loads its own data, refreshes when the screen
 * comes back (a step done in Conta), and renders nothing when there is
 * nothing to do or the card was hidden.
 */
export function FirstStepsCard() {
  const palette = usePalette();
  const reach = useAppReach();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["first-steps"], queryFn: () => api.guide.firstSteps({}) });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const data = query.data?.steps;
  const hide = useMutation({
    mutationFn: (companyId: string) => api.guide.markStep({ companyId, key: "first_steps_hidden" }),
    onSuccess: () => {
      haptic.success();
      return queryClient.invalidateQueries({ queryKey: ["first-steps"] });
    },
    onError: () => haptic.error(),
  });
  if (!data || !data.steps.length) return null;
  const done = data.steps.filter((s) => s.done).length;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginHorizontal: 4 }}>
        <Text variant="heading" accessibilityRole="header">
          Primeiros passos
        </Text>
        {!data.forced ? (
          <>
            <Text variant="caption" tone="muted" accessibilityLabel={`${done} de ${data.steps.length} feitos`} style={{ fontVariant: ["tabular-nums"] }}>
              {done} de {data.steps.length}
            </Text>
            <View style={{ flex: 1 }} />
            <Button
              title="Ocultar"
              variant="plain"
              size="small"
              busy={hide.isPending}
              accessibilityHint="Esconde os primeiros passos do Início"
              onPress={() => hide.mutate(data.companyId)}
            />
          </>
        ) : null}
      </View>
      {hide.isError ? (
        <Text variant="caption" tone="destructive" style={{ marginHorizontal: 4 }}>
          Não foi possível ocultar. Tente de novo.
        </Text>
      ) : null}
      <Section indent={52}>
        {data.steps.map((step) => (
          <ListRow
            key={step.key}
            leading={
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: step.done ? 0 : 1.5,
                  borderColor: palette.tertiary,
                  backgroundColor: step.done ? palette.success : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {step.done ? <SymbolView name="checkmark" size={12} weight="bold" tintColor={palette.card} accessible={false} /> : null}
              </View>
            }
            title={
              <Text
                variant="body"
                tone={step.done ? "muted" : "foreground"}
                style={step.done ? { textDecorationLine: "line-through" } : undefined}
              >
                {step.title}
              </Text>
            }
            accessibilityLabel={`${step.title}${step.done ? ", feito" : ""}`}
            onPress={() => followHelpLink(step.href, reach, "app")}
          />
        ))}
      </Section>
    </View>
  );
}
