import { useCallback, useState } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { QueryClientProvider } from "@tanstack/react-query";
import { authClient } from "@/lib/auth";
import { queryClient } from "@/lib/api";
// From launch: the banner with the app open, taps on notifications (kept until
// signed in and unlocked) and the icon's badge. Permission is asked from Início's card.
import "@/lib/push";
import { fonts } from "@/lib/theme";
import { Opening } from "@/components/opening";

SplashScreen.preventAutoHideAsync();

/**
 * The app's root: fonts, data cache and the session guard. Signed in, the
 * tabs; signed out (or waiting for the second step), the sign-in screens.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const [loaded] = useFonts({
    [fonts.regular]: require("@/assets/fonts/Geist-Regular.ttf"),
    [fonts.semibold]: require("@/assets/fonts/Geist-Medium.ttf"),
    [fonts.bold]: require("@/assets/fonts/Geist-SemiBold.ttf"),
  });
  const { data: session, isPending } = authClient.useSession();
  // Only the first check holds the splash. Later ones (the app coming back
  // from WhatsApp to type the code) must not unmount the screens, or the
  // sign-in loses the step it was on.
  const [booted, setBooted] = useState(false);
  if (loaded && !isPending && !booted) setBooted(true);
  const ready = booted;
  // The native splash hides once the opening is on screen over it (same violet, same symbol).
  const [opened, setOpened] = useState(false);
  const hideSplash = useCallback(() => SplashScreen.hide(), []);
  const finishOpening = useCallback(() => setOpened(true), []);
  if (!ready) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
        {!opened && <Opening onShown={hideSplash} onDone={finishOpening} />}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
