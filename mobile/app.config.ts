import type { ExpoConfig } from "expo/config";

// APP_ENV picks the Console the app talks to: development (the Console on
// this Mac, port 3100), preview (a Vercel preview URL in CONSOLE_URL) or
// production. EAS sets it per build profile (eas.json).
const env = process.env.APP_ENV ?? "development";
const consoleUrl =
  process.env.CONSOLE_URL ??
  (env === "production" ? "https://console.anuntech.com" : "http://localhost:3100");
// Areas the app shows; the same list the Console serves in /.well-known
// (src/lib/api/app-links.ts). Change both together.
const linkPaths = ["/painel", "/chamados", "/financeiro"];
const MICROPHONE_USAGE =
  "O Console usa o microfone só quando você toca em Falar, para transformar sua voz em texto. O áudio não fica guardado.";

const config: ExpoConfig = {
  name: env === "production" ? "Anuntech Console" : `Console (${env})`,
  slug: "anuntech",
  owner: process.env.EXPO_OWNER ?? "anuntech",
  version: "1.2.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "anuntech",
  userInterfaceStyle: "automatic",
  ios: {
    // ANUNTECH CORPORATE LTDA; not a secret (it is in every signed build and in the AASA file).
    appleTeamId: "U3865A7R9L",
    bundleIdentifier:
      env === "production" ? "com.anuntech.console" : `com.anuntech.console.${env}`,
    supportsTablet: false,
    ...(env === "production"
      ? { associatedDomains: ["applinks:console.anuntech.com", "webcredentials:console.anuntech.com"] }
      : {}),
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: env === "production" ? "com.anuntech.console" : `com.anuntech.console.${env}`,
    adaptiveIcon: {
      backgroundColor: "#6E56FF",
      foregroundImage: "./assets/images/android-foreground.png",
      backgroundImage: "./assets/images/android-background.png",
      monochromeImage: "./assets/images/android-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    intentFilters:
      env === "production"
        ? [
            {
              action: "VIEW",
              autoVerify: true,
              data: linkPaths.map((pathPrefix) => ({
                scheme: "https",
                host: "console.anuntech.com",
                pathPrefix,
              })),
              category: ["BROWSABLE", "DEFAULT"],
            },
          ]
        : [],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission: "O Console usa suas fotos só quando você escolhe uma para o seu perfil.",
        cameraPermission: "O Console usa a câmera só quando você tira uma foto para o seu perfil.",
        // The picker never records video; the text is the dictation's, so both plugins write the same one.
        microphonePermission: MICROPHONE_USAGE,
      },
    ],
    [
      "expo-audio",
      {
        // Dictation only (assistant and tickets): recording stops when the app leaves the screen.
        microphonePermission: MICROPHONE_USAGE,
        recordAudioAndroid: true,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    [
      "expo-splash-screen",
      {
        // Same violet and symbol size as the opening animation (src/components/opening.tsx).
        backgroundColor: "#6E56FF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#6E56FF",
        // Push needs an App ID with the capability, which EAS creates; a build
        // signed in Xcode with the team's wildcard profile cannot have it.
        enableRemoteNotifications: env === "production" || !!process.env.EAS_BUILD,
      },
    ],
    [
      "expo-local-authentication",
      { faceIDPermission: "O Console usa o Face ID para destravar o app." },
    ],
  ],
  // Over-the-air updates (EAS Update) for JavaScript only; a new native
  // permission or module always ships as a store build (runtimeVersion follows the app version).
  updates: { url: "https://u.expo.dev/365924c6-2340-4ad8-8dad-2eb9accb01e8" },
  runtimeVersion: { policy: "appVersion" },
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    consoleUrl,
    env,
    // The Expo project (expo.dev); push tokens and EAS builds belong to it.
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "365924c6-2340-4ad8-8dad-2eb9accb01e8" },
  },
};

export default config;
