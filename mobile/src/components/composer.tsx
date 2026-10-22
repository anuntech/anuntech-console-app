import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { SymbolView } from "expo-symbols";
import { haptic } from "@/lib/haptics";
import { useKeyboardVisible, useBottomBarSpace } from "@/lib/layout";
import { popSpring } from "@/lib/motion";
import { fonts, raised, rounded, usePalette } from "@/lib/theme";
import { Notice } from "./surface";

/**
 * The message box of a conversation (a ticket, the assistant): one floating
 * capsule above the tab bar, with a round send button that lights up when
 * there is something to send.
 */
export function Composer({
  value,
  onChangeText,
  onSend,
  placeholder,
  sendLabel,
  busy = false,
  onStop,
  error,
  testID,
  sendTestID,
  maxLength = 10000,
  accessory,
  status,
  footer,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  sendLabel: string;
  busy?: boolean;
  onStop?: () => void;
  error?: string | null;
  testID?: string;
  sendTestID?: string;
  maxLength?: number;
  /** A button inside the box, before send (the microphone). */
  accessory?: ReactNode;
  /** A line above the box (what the microphone is doing). */
  status?: ReactNode;
  /** A line under the box (the assistant's shortcuts). */
  footer?: ReactNode;
}) {
  const palette = usePalette();
  const tabBar = useBottomBarSpace();
  const typing = useKeyboardVisible();
  const ready = !!value.trim() && !busy;
  const stop = busy && !!onStop;
  const active = ready || stop;
  const scale = useSharedValue(active ? 1 : 0.85);
  useEffect(() => {
    scale.set(withSpring(active ? 1 : 0.85, popSpring));
  }, [active, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: typing ? 8 : tabBar, gap: 8 }}>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {status}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          backgroundColor: palette.card,
          ...rounded(24),
          minHeight: 48,
          ...raised(palette, "float"),
        }}
      >
        <TextInput
          testID={testID}
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          multiline
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          style={{
            flex: 1,
            maxHeight: 140,
            paddingLeft: 18,
            paddingRight: 8,
            paddingTop: 13,
            paddingBottom: 13,
            fontFamily: fonts.regular,
            fontSize: 17,
            lineHeight: 22,
            letterSpacing: 0,
            textAlign: "left",
            color: palette.foreground,
          }}
        />
        {accessory ? <View style={{ marginVertical: 7, marginLeft: 2 }}>{accessory}</View> : null}
        <Animated.View style={[{ margin: 7 }, pop]}>
          <Pressable
            testID={sendTestID}
            accessibilityRole="button"
            accessibilityLabel={stop ? "Parar resposta" : sendLabel}
            accessibilityState={{ disabled: !active }}
            disabled={!active}
            hitSlop={7}
            onPress={() => {
              if (stop) return onStop?.();
              haptic.light();
              onSend();
            }}
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? (pressed ? palette.primaryPressed : palette.primary) : palette.fill,
            })}
          >
            {busy && !onStop ? (
              <ActivityIndicator size="small" color={palette.primaryForeground} />
            ) : (
              <SymbolView
                name={stop ? "stop.fill" : "arrow.up"}
                size={stop ? 13 : 16}
                weight="bold"
                tintColor={active ? palette.primaryForeground : palette.tertiary}
                accessible={false}
              />
            )}
          </Pressable>
        </Animated.View>
      </View>
      {footer}
    </View>
  );
}
