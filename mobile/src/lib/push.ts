import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { api } from "./api";
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
