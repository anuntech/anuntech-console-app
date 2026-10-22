import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { router, useRootNavigationState } from "expo-router";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { api, queryClient } from "./api";
import { EAS_PROJECT_ID } from "./config";

const TOKEN_KEY = "console.push-token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for permission once and registers this phone with the Console. Quiet
 * on failure: without push the app still works, and it tries again next time.
 */
export async function registerForPush() {
  if (!Device.isDevice || !EAS_PROJECT_ID) return;
  try {
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("default", {
        name: "Avisos do Console",
        importance: AndroidImportance.HIGH,
      });
    const current = await Notifications.getPermissionsAsync();
    const status = current.granted ? current.status : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
    await api.devices.register({
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: Constants.expoConfig?.version,
    });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    /* Offline or the Console refused: the next launch tries again. */
  }
}

/** Before signing out: this phone stops receiving the person's notifications. */
export async function unregisterPush() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  try {
    await api.devices.unregister({ token });
  } catch {
    /* The session may be gone already; the server disables stale tokens. */
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * Where a notification points: the server sends a Console path in data.url
 * (/chamados/<id>, /financeiro/<id>…). Each area knows its screen and the
 * queries that show it, so a notice can open the record and refresh it.
 */
const areas = {
  chamados: { list: "tickets", detail: "ticket" },
  financeiro: { list: "invoices", detail: "invoice" },
  contratos: { list: "contracts", detail: "contract" },
  orcamentos: { list: "quotes", detail: "quote" },
  projetos: { list: "projects", detail: "project" },
} as const;
type Area = keyof typeof areas;
type Target = { area: Area; id: string };

const PATH = /^\/(chamados|financeiro|contratos|orcamentos|projetos)\/([\w-]+)\/?(?:[?#].*)?$/;

function targetOf(notification: Notifications.Notification): Target | null {
  const url = notification.request.content.data?.url;
  if (typeof url !== "string") return null;
  const match = PATH.exec(url.replace(/^https?:\/\/[^/]+/, ""));
  return match ? { area: match[1] as Area, id: match[2] } : null;
}

/** Início's badges always; the area's list and the record itself when the notice names one. */
function refresh(target: Target | null) {
  void queryClient.invalidateQueries({ queryKey: ["overview"] });
  if (!target) return;
  void queryClient.invalidateQueries({ queryKey: [areas[target.area].list] });
  void queryClient.invalidateQueries({ queryKey: [areas[target.area].detail, target.id] });
}

function open({ area, id }: Target) {
  switch (area) {
    case "chamados":
      return router.navigate({ pathname: "/chamados/[id]", params: { id } });
    case "financeiro":
      return router.navigate({ pathname: "/financeiro/[id]", params: { id } });
    case "contratos":
      return router.navigate({ pathname: "/contratos/[id]", params: { id } });
    case "orcamentos":
      return router.navigate({ pathname: "/orcamentos/[id]", params: { id } });
    case "projetos":
      return router.navigate({ pathname: "/projetos/[id]", params: { id } });
  }
}

/*
 * A tapped notification waits here until the app can show it: a tap can
 * come before sign-in or behind the Face ID lock. Each response is taken
 * once, by its notification's identifier: the listener and the launch
 * response report the same tap on a cold start.
 */
const taken = new Set<string>();
let waiting: Target | null = null;
const watchers = new Set<() => void>();
const notify = () => watchers.forEach((watcher) => watcher());
const watch = (watcher: () => void) => {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
};
const waitingTarget = () => waiting;

function take(response: Notifications.NotificationResponse | null) {
  if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const { identifier } = response.notification.request;
  if (taken.has(identifier)) return;
  taken.add(identifier);
  const target = targetOf(response.notification);
  refresh(target);
  if (!target) return;
  waiting = target;
  notify();
}

/** The icon's count goes once the person is looking at the app. */
function clearBadge() {
  Notifications.setBadgeCountAsync(0).catch(() => undefined);
}

if (Platform.OS !== "web") {
  // While the app runs, open or in the background.
  Notifications.addNotificationResponseReceivedListener(take);
  // Open: the banner shows (handler above) and the screens behind it catch up.
  Notifications.addNotificationReceivedListener((notification) => refresh(targetOf(notification)));
  // A cold start: the tap that launched the app.
  try {
    take(Notifications.getLastNotificationResponse());
  } catch {
    /* Not available on this platform: nothing launched the app from a notice. */
  }
  clearBadge();
  AppState.addEventListener("change", (state) => {
    if (state === "active") clearBadge();
  });
}

/**
 * Opens the record a tapped notification points to, once the app is ready
 * for it: mounted inside the signed-in screens, with `unlocked` false while
 * the Face ID lock is up (or still deciding).
 */
export function useNotificationTaps(unlocked: boolean) {
  const target = useSyncExternalStore(watch, waitingTarget);
  const navigationReady = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (!unlocked || !navigationReady || !target) return;
    waiting = null;
    notify();
    open(target);
    try {
      // A reload in the same launch must not open it again.
      Notifications.clearLastNotificationResponse();
    } catch {
      /* Nothing stored to clear. */
    }
  }, [unlocked, navigationReady, target]);
}
