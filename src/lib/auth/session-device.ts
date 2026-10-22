export function sessionDevice(agent: string | null) {
  if (!agent) return "Dispositivo não informado";
  // The native app sends "AnuntechApp/<version> (iPhone; iOS <x>)" or "(Android …)".
  const browser = /\bAnuntechApp\//.test(agent) ? "App Anuntech" : /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /(?:Chrome|CriOS)\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Navegador";
  const device = /iPhone/.test(agent) ? "iPhone" : /iPad/.test(agent) ? "iPad" : /Android/.test(agent) ? "Android" : /Windows/.test(agent) ? "Windows" : /Macintosh|Mac OS X/.test(agent) ? "Mac" : /Linux/.test(agent) ? "Linux" : "dispositivo";
  return `${browser} · ${device}`;
}

/** How Segurança names a session's state (recentSessions in session-history.ts). */
export const sessionStatusLabel: Record<string, string> = {
  current: "Esta sessão",
  active: "Ativa",
  expired: "Expirada",
  ended: "Encerrada",
};
