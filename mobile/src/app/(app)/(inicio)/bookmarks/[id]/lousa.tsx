import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { authClient } from "@/lib/auth";
import { boardPath } from "@/lib/bookmarks";
import { CONSOLE_URL } from "@/lib/config";
import { openConsole } from "@/lib/console-web";
import { useBottomBarSpace } from "@/lib/layout";
import { HeaderIconButton } from "@/lib/stack";
import { space, usePalette } from "@/lib/theme";

const MIN = 1;
const MAX = 5;
/** Where a double tap zooms to. */
const STEP = 2.5;

/** The session cookie: the picture is served only to who can see the bookmark. */
function useSessionCookie() {
  const [cookie, setCookie] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void Promise.resolve(authClient.getCookie()).then((value) => live && setCookie(value || null));
    return () => {
      live = false;
    };
  }, []);
  return cookie;
}

/** Opens the board on the web, signed in, where it is drawn (Excalidraw needs a big screen and a mouse). */
function openInConsole(id: string) {
  return openConsole(boardPath(id));
}

/**
 * A whiteboard, read only: the PNG the Console keeps of it, full screen,
 * with pinch, drag and double tap to zoom. Drawing stays on the web
 * ("Abrir no Console").
 */
export default function Board() {
  const { id, title, v } = useLocalSearchParams<{ id: string; title?: string; v?: string }>();
  const palette = usePalette();
  const bottom = useBottomBarSpace();
  const cookie = useSessionCookie();
  const [state, setState] = useState<"loading" | "shown" | "empty">("loading");
  const reduceMotion = useReducedMotion();

  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const duration = reduceMotion ? 0 : 220;

  const pinch = usePinchGesture({
    onBegin: () => {
      "worklet";
      saved.set(scale.get());
    },
    onUpdate: (event) => {
      "worklet";
      scale.set(Math.min(MAX, Math.max(0.8, saved.get() * event.scale)));
    },
    onDeactivate: () => {
      "worklet";
      if (scale.get() <= MIN) {
        scale.set(withTiming(MIN, { duration }));
        x.set(withTiming(0, { duration }));
        y.set(withTiming(0, { duration }));
      }
    },
  });
  const pan = usePanGesture({
    minPointers: 1,
    onBegin: () => {
      "worklet";
      startX.set(x.get());
      startY.set(y.get());
    },
    onUpdate: (event) => {
      "worklet";
      // At its normal size the picture stays put; zoomed in, it moves under the finger.
      if (scale.get() <= MIN) return;
      x.set(startX.get() + event.translationX);
      y.set(startY.get() + event.translationY);
    },
  });
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: () => {
      "worklet";
      const next = scale.get() > MIN ? MIN : STEP;
      scale.set(withTiming(next, { duration }));
      if (next === MIN) {
        x.set(withTiming(0, { duration }));
        y.set(withTiming(0, { duration }));
      }
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  const name = title || "Lousa";
  const source = `${CONSOLE_URL}/api/bookmarks/${id}/preview${v ? `?v=${encodeURIComponent(v)}` : ""}`;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <HeaderIconButton symbol="safari" label="Abrir no Console" testID="open-board" onPress={() => void openInConsole(id)} />
          ),
        }}
      />
      {state === "empty" || cookie === null ? (
        <EmptyState
          icon="scribble.variable"
          title="Esta lousa ainda não tem desenho"
          text="Desenhe no Console, no computador. Aqui você vê o desenho e pode dar zoom."
          action={{ label: "Abrir no Console", icon: "safari", onPress: () => void openInConsole(id) }}
        />
      ) : (
        <View style={{ flex: 1, overflow: "hidden", backgroundColor: "#ffffff" }}>
          {cookie ? (
            <GestureDetector gesture={gesture}>
              <Animated.View style={[{ flex: 1 }, style]}>
                <Image
                  source={{ uri: source, headers: { Cookie: cookie } }}
                  style={{ flex: 1 }}
                  contentFit="contain"
                  cachePolicy="none"
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={`Lousa ${name}`}
                  accessibilityHint="Aproxime ou afaste dois dedos para dar zoom. Toque duas vezes para ampliar."
                  onLoad={() => setState("shown")}
                  onError={() => setState("empty")}
                />
              </Animated.View>
            </GestureDetector>
          ) : null}
          {state === "loading" ? (
            <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator accessibilityLabel="Carregando a lousa" />
            </View>
          ) : null}
          {state === "shown" ? (
            <View style={{ position: "absolute", left: space.gutter, right: space.gutter, bottom }}>
              <Button title="Abrir no Console" icon="safari" variant="secondary" onPress={() => void openInConsole(id)} />
            </View>
          ) : null}
        </View>
      )}
    </GestureHandlerRootView>
  );
}
