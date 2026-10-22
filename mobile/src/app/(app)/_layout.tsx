import { Platform } from "react-native";
import { NativeTabs } from "expo-router/native-tabs";
import { useQuery } from "@tanstack/react-query";
// Shows notifications that arrive with the app open. Permission is asked from Início's card, not on launch.
import "@/lib/push";
import { api } from "@/lib/api";
import { AppLock } from "@/lib/lock";
import { usePalette } from "@/lib/theme";
import { useMe } from "@/lib/me";

/** Signed in: the tabs, behind the Face ID lock when the person turned it on. */
export default function AppLayout() {
  const palette = usePalette();
  const me = useMe();
  // Financeiro is for the team and the companies' Administradores; a Membro never sees money.
  const finance = !!me.data && (me.data.staff || me.data.companies.some((c) => c.role === "manager"));
  // The same list Início shows: the badges count what waits for the person.
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api.overview.get({}), enabled: !!me.data });
  const waiting = overview.data?.waiting.length ?? 0;
  const overdue = overview.data?.toPay.filter((invoice) => invoice.display === "overdue").length ?? 0;
  // On iOS only the tint: the rest would cover the Liquid Glass bar.
  const android =
    Platform.OS === "android"
      ? {
          backgroundColor: palette.card,
          indicatorColor: palette.accent,
          iconColor: { default: palette.muted, selected: palette.primary },
          labelStyle: { selected: { color: palette.primary } },
        }
      : {};
  return (
    <AppLock>
      <NativeTabs tintColor={palette.primary} {...android}>
        <NativeTabs.Trigger name="(inicio)">
          <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="chamados">
          <NativeTabs.Trigger.Label>Chamados</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }}
            md="forum"
          />
          {/* A value wins over `hidden` in expo-router: no value at all when there is nothing. */}
          <NativeTabs.Trigger.Badge hidden={!waiting}>{waiting ? String(waiting) : undefined}</NativeTabs.Trigger.Badge>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="assistente">
          <NativeTabs.Trigger.Label>Assistente</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "sparkles", selected: "sparkles" }} md="auto_awesome" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="financeiro" hidden={!finance}>
          <NativeTabs.Trigger.Label>Financeiro</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "creditcard", selected: "creditcard.fill" }}
            md="payments"
          />
          <NativeTabs.Trigger.Badge hidden={!overdue}>{overdue ? String(overdue) : undefined}</NativeTabs.Trigger.Badge>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="conta">
          <NativeTabs.Trigger.Label>Conta</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
            md="account_circle"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </AppLock>
  );
}
