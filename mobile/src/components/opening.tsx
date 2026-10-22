import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { MARK_CELLS } from "@/lib/brand-mark-shape";

/**
 * The opening after the native splash: the same violet and the same symbol (so
 * there is no jump), then a wave crosses the pixels, the symbol slides left as
 * "anun" and then "tech" appear, and the screen opens onto the app.
 * Reduced motion skips straight to the app with a short fade.
 */
export const OPENING_VIOLET = "#6E56FF";

/** Symbol size on the native splash (app.config.ts, imageWidth). */
const SPLASH = 120;
// The lockup in symbol units (anuntech-brand, logo.mjs): symbol 100, gap 26,
// name at body 76 whose image is 429.8 × 84 at body 100 with the baseline at 76.
const NAME_W = 429.8 * 0.76;
const NAME_H = 84 * 0.76;
const NAME_TOP = 50 + 76 * 0.27 - 76 * 0.76;
const LOCKUP_W = 100 + 26 + NAME_W;

const T = { wave: 700, moveAt: 450, move: 650, anunAt: 800, anun: 500, techAt: 1100, tech: 400, exitAt: 1900, exit: 380 };
const eased = (duration: number) => ({ duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });

function Pixel({ i, wave }: { i: number; wave: SharedValue<number> }) {
  const [x, y, s] = MARK_CELLS[i];
  const k = SPLASH / 100;
  // Columns light up from the smooth edge outwards, then settle back.
  const phase = (x - 50) / 46 + (y - 4) / 400;
  const style = useAnimatedStyle(() => {
    const d = Math.abs(wave.get() * 1.4 - phase);
    return { opacity: 1 - 0.75 * Math.max(0, 1 - d * 4) };
  });
  return <Animated.View style={[styles.pixel, { left: x * k, top: y * k, width: s * k, height: s * k }, style]} />;
}

export function Opening({ onShown, onDone }: { onShown: () => void; onDone: () => void }) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const lockup = Math.min(width * 0.72, 300);
  const unit = lockup / LOCKUP_W;
  const wave = useSharedValue(0);
  const move = useSharedValue(0);
  const anun = useSharedValue(0);
  const tech = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      exit.set(withTiming(1, { duration: 200 }, (ok) => ok && scheduleOnRN(onDone)));
      return;
    }
    wave.set(withTiming(1, { duration: T.wave, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }));
    move.set(withDelay(T.moveAt, withTiming(1, eased(T.move))));
    anun.set(withDelay(T.anunAt, withTiming(1, eased(T.anun))));
    tech.set(withDelay(T.techAt, withTiming(1, { duration: T.tech, easing: Easing.steps(5), reduceMotion: ReduceMotion.Never })));
    exit.set(withDelay(T.exitAt, withTiming(1, eased(T.exit), (ok) => ok && scheduleOnRN(onDone))));
  }, [reduced, wave, move, anun, tech, exit, onDone]);

  // The symbol starts as on the splash (SPLASH wide, centred) and ends as the lockup's symbol.
  const finalScale = (100 * unit) / SPLASH;
  const finalShift = -lockup / 2 + 50 * unit;
  const symbolStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: finalShift * move.get() }, { scale: 1 + (finalScale - 1) * move.get() }],
  }));
  const anunStyle = useAnimatedStyle(() => ({ opacity: anun.get(), transform: [{ translateX: (1 - anun.get()) * -10 }] }));
  const techStyle = useAnimatedStyle(() => ({ opacity: tech.get() }));
  const screenStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.get(), transform: [{ scale: 1 + 0.06 * exit.get() }] }));

  const name = { left: -lockup / 2 + 126 * unit, top: -50 * unit + NAME_TOP * unit, width: NAME_W * unit, height: NAME_H * unit };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.screen, screenStyle]} onLayout={onShown} pointerEvents="none">
      <View style={styles.center}>
        <Animated.View style={[styles.symbol, symbolStyle]}>
          <View style={styles.halfClip}>
            <View style={styles.circle} />
          </View>
          {MARK_CELLS.map((_, i) => (
            <Pixel key={i} i={i} wave={wave} />
          ))}
        </Animated.View>
        <Animated.Image source={require("@/assets/images/wordmark-anun.png")} style={[styles.name, name, anunStyle]} resizeMode="stretch" />
        <Animated.Image source={require("@/assets/images/wordmark-tech.png")} style={[styles.name, name, techStyle]} resizeMode="stretch" />
      </View>
    </Animated.View>
  );
}

const k = SPLASH / 100;
const styles = StyleSheet.create({
  screen: { backgroundColor: OPENING_VIOLET, alignItems: "center", justifyContent: "center", zIndex: 10 },
  center: { width: 0, height: 0, alignItems: "center", justifyContent: "center" },
  symbol: { position: "absolute", width: SPLASH, height: SPLASH, left: -SPLASH / 2, top: -SPLASH / 2 },
  // Left half of a circle of radius 46 centred at (50, 50).
  halfClip: { position: "absolute", left: 4 * k, top: 4 * k, width: 46 * k, height: 92 * k, overflow: "hidden" },
  circle: { width: 92 * k, height: 92 * k, borderRadius: 46 * k, backgroundColor: "#ffffff" },
  pixel: { position: "absolute", backgroundColor: "#ffffff" },
  name: { position: "absolute" },
});
