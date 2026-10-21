import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { QueryClientProvider } from "@tanstack/react-query";
import { authClient } from "@/lib/auth";
import { queryClient } from "@/lib/api";
import { fonts } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

/**
 * The app's root: fonts, data cache and the session guard. Signed in, the
 * tabs; signed out (or waiting for the second step), the sign-in screens.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const [loaded] = useFonts({
    [fonts.regular]: require("@/assets/fonts/sofia-regular.otf"),
    [fonts.semibold]: require("@/assets/fonts/sofia-semibold.otf"),
    [fonts.bold]: require("@/assets/fonts/sofia-bold.otf"),
  });
  const { data: session, isPending } = authClient.useSession();
  const ready = loaded && !isPending;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}
