import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  consoleUrl?: string;
  env?: string;
  eas?: { projectId?: string };
};

/** The Console this build talks to (app.config.ts). */
export const CONSOLE_URL = (extra.consoleUrl ?? "https://console.anuntech.com").replace(/\/$/, "");
export const APP_ENV = extra.env ?? "production";
export const EAS_PROJECT_ID = extra.eas?.projectId ?? Constants.easConfig?.projectId;
/** Profile pictures and illustrated avatars are paths on the Console. */
export const imageUrl = (image: string | null | undefined) =>
  !image ? null : image.startsWith("/") ? `${CONSOLE_URL}${image}` : image;
/** A Brazilian number as the web shows it, (11) 99999-9999; another country stays as stored. */
export function formatPhone(phone: string) {
  if (!phone.startsWith("+55")) return phone;
  const n = phone.slice(3, 14);
  const split = n.length > 10 ? 7 : 6;
  return `(${n.slice(0, 2)}) ${n.slice(2, split)}-${n.slice(split)}`;
}
