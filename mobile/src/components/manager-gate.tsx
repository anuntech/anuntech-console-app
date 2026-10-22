import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { errorMessage } from "@/lib/api";
import { useMe } from "@/lib/me";
import { space, usePalette } from "@/lib/theme";
import { EmptyState } from "./empty-state";
import { Bar, useDelayed } from "./skeleton";

/** A page that failed to load: what went wrong and a way to try again. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      icon="exclamationmark.triangle"
      title="Não foi possível carregar"
      text={errorMessage(error)}
      action={{ label: "Tentar de novo", icon: "arrow.clockwise", onPress: onRetry }}
    />
  );
}

/** Placeholder for a form: label and field, a few times over. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <View accessible accessibilityLabel="Carregando" style={{ gap: space.form }}>
      {Array.from({ length: fields }, (_, i) => (
        <View key={i} style={{ gap: space.sm }}>
          <Bar width={120} height={15} />
          <Bar width="100%" height={50} radius={12} />
        </View>
      ))}
    </View>
  );
}

/** The scrolling background the gate's states sit on, under the native header. */
function Page({ children }: { children?: ReactNode }) {
  const palette = usePalette();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block }}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Dados da empresa, Membros and Notificações belong to whoever manages exactly
 * one company (me.managedCompanyId). Anyone else who lands here (a link, an
 * old screen) sees why, and the screen's queries never run.
 */
export function ManagerGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const loading = useDelayed(me.isPending);
  if (me.isPending) return <Page>{loading ? <FormSkeleton fields={3} /> : null}</Page>;
  if (me.error && !me.data)
    return (
      <Page>
        <LoadError error={me.error} onRetry={() => void me.refetch()} />
      </Page>
    );
  if (!me.data?.managedCompanyId)
    return (
      <Page>
        <EmptyState
          icon="lock.fill"
          title="Só para Administradores"
          text="Dados da empresa, Membros e Notificações ficam com quem administra a empresa no Console."
          action={router.canGoBack() ? { label: "Voltar", onPress: () => router.back() } : undefined}
        />
      </Page>
    );
  return children;
}
