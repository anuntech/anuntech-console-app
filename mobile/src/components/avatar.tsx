import { useEffect, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { authClient } from "@/lib/auth";
import { CONSOLE_URL } from "@/lib/config";
import { usePalette } from "@/lib/theme";
import { Text } from "./text";

/** A person's picture as the API describes it (contract: `avatar`). */
export type AvatarInfo = { kind: "illustration" | "photo" | "initials"; path: string | null; color: string | null };

const initials = (name: string | null | undefined, email?: string) =>
  (name || email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/** The session cookie for photos the Console serves only to signed-in people. */
function useSessionCookie() {
  const [cookie, setCookie] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.resolve(authClient.getCookie()).then((value) => live && setCookie(value || null));
    return () => {
      live = false;
    };
  }, []);
  return cookie;
}

/**
 * A round picture: the catalog illustration on its color (scaled like the
 * web's), an uploaded photo (fetched with the session) or the initials.
 */
export function Avatar({ avatar, name, email, size = 40 }: { avatar: AvatarInfo | null | undefined; name?: string | null; email?: string; size?: number }) {
  const palette = usePalette();
  const cookie = useSessionCookie();
  const frame = { width: size, height: size, borderRadius: size / 2, overflow: "hidden" as const };
  if (avatar?.kind === "illustration" && avatar.path)
    return (
      <View accessible={false} style={[frame, { backgroundColor: avatar.color ?? palette.accent }]}>
        <Image
          source={{ uri: `${CONSOLE_URL}${avatar.path}` }}
          // The web's crop: 1.75× from 50% / 30%, so the face fills the circle.
          style={{ width: size, height: size, transformOrigin: "50% 30%", transform: [{ scale: 1.75 }] }}
          contentFit="cover"
        />
      </View>
    );
  if (avatar?.kind === "photo" && avatar.path && cookie)
    return (
      <View accessible={false} style={[frame, { backgroundColor: palette.fill }]}>
        <Image source={{ uri: `${CONSOLE_URL}${avatar.path}`, headers: { Cookie: cookie } }} style={{ width: size, height: size }} contentFit="cover" />
      </View>
    );
  return (
    <View accessible={false} style={[frame, { backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }]}>
      <Text variant={size >= 56 ? "heading" : "micro"} tone="primary">
        {initials(name, email)}
      </Text>
    </View>
  );
}
