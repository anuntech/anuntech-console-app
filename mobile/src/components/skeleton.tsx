import { useEffect, useState } from "react";
import { View, type DimensionValue } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { usePalette } from "@/lib/theme";
import { GroupSeparator, groupedItem } from "./section";

/** A grey bar that breathes while the content loads (still under Reduce Motion). */
export function Bar({ width, height, radius = 6 }: { width: DimensionValue; height: number; radius?: number }) {
  const palette = usePalette();
  const reduce = useReducedMotion();
  const opacity = useSharedValue(reduce ? 0.7 : 0.5);
  useEffect(() => {
    if (!reduce) opacity.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [reduce, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, borderCurve: "continuous", backgroundColor: palette.fill }, style]} />;
}

/** True only after `delay` ms of `on`, so a cached load never flashes a skeleton. */
export function useDelayed(on: boolean, delay = 150) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setShown(true), delay);
    return () => {
      clearTimeout(timer);
      setShown(false);
    };
  }, [on, delay]);
  return on && shown;
}

/** Placeholder rows shaped like a grouped list. */
export function SkeletonRows({ count = 4, inset }: { count?: number; inset?: number }) {
  const palette = usePalette();
  return (
    <View accessible accessibilityLabel="Carregando">
      {Array.from({ length: count }, (_, i) => (
        <View key={i}>
          {i > 0 ? <GroupSeparator inset={inset} /> : null}
          <View style={[groupedItem(palette, i, count, inset), { height: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 }]}>
            <Bar width={32} height={32} radius={16} />
            <View style={{ flex: 1, gap: 8 }}>
              <Bar width="60%" height={16} />
              <Bar width="40%" height={12} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Placeholder for a detail screen's header: pill, title, meta. */
export function SkeletonHeader() {
  return (
    <View accessible accessibilityLabel="Carregando" style={{ gap: 10 }}>
      <Bar width={110} height={24} radius={12} />
      <Bar width="70%" height={28} />
      <Bar width="50%" height={15} />
    </View>
  );
}
