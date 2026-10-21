import { useEffect } from "react";
import { NativeTabs } from "expo-router/native-tabs";
import { registerForPush } from "@/lib/push";
import { AppLock } from "@/lib/lock";
import { usePalette } from "@/lib/theme";
import { useMe } from "@/lib/me";

/** Signed in: the tabs, behind the Face ID lock when the person turned it on. */
export default function AppLayout() {
  const palette = usePalette();
  const me = useMe();
  // Financeiro is for the team and the companies' Administradores; a Membro never sees money.
  const finance = !!me.data && (me.data.staff || me.data.companies.some((c) => c.role === "manager"));
  useEffect(() => {
    void registerForPush();
  }, []);
  return (
    <AppLock>
      <NativeTabs
        backgroundColor={palette.card}
        indicatorColor={palette.accent}
        tintColor={palette.primary}
        iconColor={{ default: palette.muted, selected: palette.primary }}
        labelStyle={{ selected: { color: palette.primary } }}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="chamados">
          <NativeTabs.Trigger.Label>Chamados</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }}
            md="forum"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="financeiro" hidden={!finance}>
          <NativeTabs.Trigger.Label>Financeiro</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "creditcard", selected: "creditcard.fill" }}
            md="payments"
          />
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
