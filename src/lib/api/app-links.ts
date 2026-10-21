// Which console.anuntech.com links open the native app instead of the browser
// (iOS universal links and Android app links), served from /.well-known.
// Only the areas the app shows; /pagar stays on the web for the client's
// customers, and sign-in and the API never open the app.
export const APP_BUNDLE_ID = "com.anuntech.console";
export const APP_LINK_PATHS = [
  "/painel",
  "/chamados",
  "/chamados/*",
  "/financeiro",
  "/financeiro/*",
];

/** apple-app-site-association for a Team ID, or null without one. */
export function appleAssociation(teamId: string | undefined) {
  const team = teamId?.trim();
  if (!team || !/^[A-Z0-9]{10}$/.test(team)) return null;
  const appID = `${team}.${APP_BUNDLE_ID}`;
  return {
    applinks: {
      details: [
        { appIDs: [appID], components: APP_LINK_PATHS.map((path) => ({ "/": path })) },
      ],
    },
    webcredentials: { apps: [appID] },
  };
}

/** assetlinks.json for the signing certificates' SHA-256, or null without one. */
export function androidAssetLinks(fingerprints: string | undefined) {
  const list = (fingerprints || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
  if (!list.length) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: APP_BUNDLE_ID,
        sha256_cert_fingerprints: list,
      },
    },
  ];
}
