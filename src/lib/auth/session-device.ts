export function sessionDevice(agent: string | null) {
  if (!agent) return "Dispositivo não informado";
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /(?:Chrome|CriOS)\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Navegador";
  const device = /iPhone/.test(agent) ? "iPhone" : /iPad/.test(agent) ? "iPad" : /Android/.test(agent) ? "Android" : /Windows/.test(agent) ? "Windows" : /Macintosh|Mac OS X/.test(agent) ? "Mac" : /Linux/.test(agent) ? "Linux" : "dispositivo";
  return `${browser} · ${device}`;
}
