import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, ReduceMotion } from "react-native-reanimated";

/** One motion language: quick ease-out entries, tight springs on press, nothing under Reduce Motion. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const pressSpring = { damping: 20, stiffness: 300, mass: 0.6 };
export const popSpring = { damping: 14, stiffness: 260, mass: 0.6 };
export const enter = FadeIn.duration(200).easing(easeOut).reduceMotion(ReduceMotion.System);
export const enterUp = FadeInDown.duration(220).easing(easeOut).reduceMotion(ReduceMotion.System);
export const exit = FadeOut.duration(150).reduceMotion(ReduceMotion.System);
export const layout = LinearTransition.duration(200).easing(easeOut).reduceMotion(ReduceMotion.System);
