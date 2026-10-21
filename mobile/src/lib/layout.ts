import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "./theme";

/**
 * Room the tab bar takes at the bottom. On iOS 26 the bar floats over the
 * content, so lists and the reply box end with this much space or their last
 * line sits under the menu. Android's bar sits below the content.
 */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return insets.bottom + (Platform.OS === "ios" ? 72 : space.lg);
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
