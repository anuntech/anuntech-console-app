import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "./theme";

/**
 * Room at the end of a scrolling screen. On iOS the scroll view already stops
 * above the floating tab bar (`contentInsetAdjustmentBehavior="automatic"`),
 * so it only needs a little air; adding the bar again left a blank band.
 * Android's bar sits below the content, but the system bar does not.
 */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return Platform.OS === "ios" ? space.lg : insets.bottom + space.lg;
}

/**
 * Room under a box pinned to the bottom (the reply box, the closed notice):
 * the safe area already includes the floating tab bar on iOS, so this keeps
 * the box just above it.
 */
export function useBottomBarSpace() {
  const insets = useSafeAreaInsets();
  return insets.bottom + (Platform.OS === "ios" ? space.md : space.xs);
}

/** Whether the keyboard is up (the tab bar is hidden behind it then). */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
