/*
 * Links that work without an account (Arquivos, phase 3). Pure, so the
 * dialog, the public pages and the tests share it.
 */

export type ShareKind = "download" | "request";
export type ShareState = "active" | "expired" | "revoked" | "exhausted";

/** How long a new link lasts, as the dialog offers it ("" never ends). */
export const EXPIRY_CHOICES = [
  { value: "1", label: "1 dia" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "", label: "Sem prazo" },
] as const;
export const DEFAULT_EXPIRY_DAYS = "7";

export function shareState(link: { revokedAt: Date | string | null; expiresAt: Date | string | null; maxDownloads: number | null; downloads: number }, now = new Date()): ShareState {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && new Date(link.expiresAt) <= now) return "expired";
  if (link.maxDownloads !== null && link.downloads >= link.maxDownloads) return "exhausted";
  return "active";
}

export const shareStateLabels: Record<ShareState, string> = {
  active: "Ativo",
  expired: "Vencido",
  revoked: "Desligado",
  exhausted: "Limite de downloads atingido",
};

/** What a visitor reads when a link no longer works. Never says what was behind it. */
export const shareClosedText: Record<Exclude<ShareState, "active">, string> = {
  expired: "Este link venceu. Peça um novo a quem enviou.",
  revoked: "Este link foi desligado por quem enviou.",
  exhausted: "Este link já foi usado o número de vezes permitido. Peça um novo a quem enviou.",
};

/**
 * Files nobody outside sends into the Console through a request link: programs
 * and scripts that run when opened. Anything else goes, as an attachment.
 */
const BLOCKED = new Set(["exe", "msi", "bat", "cmd", "com", "scr", "pif", "vbs", "vbe", "js", "jse", "wsf", "wsh", "ps1", "psm1", "sh", "apk", "app", "dmg", "pkg", "jar", "hta", "cpl", "msc", "lnk", "reg", "iso"]);

export function requestRefusal(fileName: string) {
  // As the file will be named: no control characters, and no trailing dots or spaces (Windows drops them).
  const name = fileName.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\s.]+$/, "");
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return name.includes(".") && BLOCKED.has(ext) ? "Por segurança, programas e scripts não são aceitos por este link. Envie em .zip ou fale com quem pediu." : null;
}

/** Password rules for a link: optional, 6 to 100 characters. */
export function passwordRefusal(password: string) {
  if (!password) return null;
  if (password.length < 6) return "Use uma senha de pelo menos 6 caracteres.";
  if (password.length > 100) return "Use uma senha de até 100 caracteres.";
  return null;
}

/** Visitors' tries per hour: a password (per address and per link), a download, an upload; e-mails per person. */
export const SHARE_LIMITS = { password: 10, passwordPerLink: 60, download: 120, upload: 60, email: 30 } as const;
