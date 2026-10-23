import { Platform } from "react-native";
import { SymbolView as ExpoSymbolView, type SymbolViewProps } from "expo-symbols";
import { androidSymbols } from "@/lib/android-symbols";

export type { SFSymbol } from "expo-symbols";

/**
 * expo-symbols' SymbolView, also on Android: an SF Symbol name becomes its
 * Material Symbol (lib/android-symbols.ts). iOS is untouched.
 */
export function SymbolView({ name, weight, ...props }: SymbolViewProps) {
  if (Platform.OS !== "android" || typeof name !== "string") return <ExpoSymbolView name={name} weight={weight} {...props} />;
  const android = androidSymbols[name];
  if (!android && __DEV__) console.warn(`Sem ícone do Android para "${name}" (mobile/src/lib/android-symbols.ts).`);
  // A plain weight is an iOS one; Android takes only its own weight objects.
  return <ExpoSymbolView name={{ ios: name, android: android ?? "circle" }} weight={typeof weight === "object" ? weight : undefined} {...props} />;
}
