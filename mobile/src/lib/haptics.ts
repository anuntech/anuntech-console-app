import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/*
 * The few moments the phone answers with a tap: picking an option, sending,
 * confirming, and the outcome of a change. Plain navigation stays silent.
 */
const run = (effect: () => Promise<void>) => {
  if (Platform.OS !== "web") void effect().catch(() => undefined);
};

export const haptic = {
  select: () => run(() => Haptics.selectionAsync()),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
