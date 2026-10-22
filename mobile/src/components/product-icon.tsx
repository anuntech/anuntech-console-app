import { useEffect, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { authClient } from "@/lib/auth";
import { CONSOLE_URL } from "@/lib/config";
import { rounded, usePalette } from "@/lib/theme";
import { Text } from "./text";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/**
 * A product's or service's catalog icon, as the web's ProductIcon: a gallery
 * file, or an uploaded one the Console serves only to whoever sees the item
 * (fetched with the session); the initials when there is none.
 */
export function ProductIcon({ path, name, size = 32 }: { path: string | null; name: string; size?: number }) {
  const palette = usePalette();
  const [cookie, setCookie] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const needsSession = !!path && path.startsWith("/api/");
  useEffect(() => {
    if (!needsSession) return;
    let live = true;
    void Promise.resolve(authClient.getCookie()).then((value) => live && setCookie(value || null));
    return () => {
      live = false;
    };
  }, [needsSession]);
  const frame = { width: size, height: size, ...rounded(size / 4), overflow: "hidden" as const };
  if (path && !failed && (!needsSession || cookie))
    return (
      <View accessible={false} style={[frame, { backgroundColor: palette.secondary }]}>
        <Image
          source={{ uri: `${CONSOLE_URL}${path}`, headers: needsSession && cookie ? { Cookie: cookie } : undefined }}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="disk"
          accessible={false}
          onError={() => setFailed(true)}
        />
      </View>
    );
  return (
    <View accessible={false} style={[frame, { backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }]}>
      <Text variant="micro" tone="primary">
        {initials(name)}
      </Text>
    </View>
  );
}
