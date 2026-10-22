import { useState, type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { pressSpring } from "@/lib/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A pressable that sinks a little under the finger (springs back), instead of
 * fading. An animated Pressable ignores style functions, so the pressed state
 * is tracked here and the style resolved before it is passed down.
 */
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
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        setPressed(true);
        if (!reduce) scale.set(withSpring(scaleTo, pressSpring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.set(withSpring(1, pressSpring));
        onPressOut?.(e);
      }}
      style={[typeof style === "function" ? style({ pressed }) : style, animated]}
    >
      {typeof children === "function" ? children({ pressed }) : children}
    </AnimatedPressable>
  );
}
