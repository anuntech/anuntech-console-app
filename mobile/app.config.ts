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

const config: ExpoConfig = {
  name: env === "production" ? "Anuntech Console" : `Console (${env})`,
  slug: "anuntech-console",
  owner: process.env.EXPO_OWNER,
  version: "1.0.0",
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
      backgroundColor: "#0d1d41",
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
      "expo-splash-screen",
      {
        backgroundColor: "#0d1d41",
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#1a428a",
        // Push needs an App ID with the capability (EAS creates it); a
        // development build signed in Xcode with the team's wildcard profile cannot have it.
        enableRemoteNotifications: env !== "development",
      },
    ],
    [
      "expo-local-authentication",
      { faceIDPermission: "O Console usa o Face ID para destravar o app." },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    consoleUrl,
    env,
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
};

export default config;
