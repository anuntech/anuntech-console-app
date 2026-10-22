import type { ReactNode } from "react";
import { Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { pressSpring } from "@/lib/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that sinks a little under the finger (springs back), instead of fading. */
export function PressableScale({
  scaleTo = 0.97,
  style,
  children,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
}) {
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        if (!reduce) scale.set(withSpring(scaleTo, pressSpring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, pressSpring));
        onPressOut?.(e);
      }}
      style={(state: PressableStateCallbackType) => [typeof style === "function" ? style(state) : style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
