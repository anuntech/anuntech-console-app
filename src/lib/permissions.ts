export type Role = "manager" | "member";
export type Area = "overview" | "support" | "finance";
/** Administradores veem tudo; membros só têm a área de chamados além do geral. */
export function hasPermission(role: Role, area: Area): boolean {
  return area === "overview" || role === "manager" || area === "support";
}
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
export function isAdministrator(
  email: string,
  verified: boolean,
  configured: string | undefined,
) {
  return (
    verified &&
    !!configured?.trim() &&
    normalizeEmail(email) === normalizeEmail(configured)
  );
}
export function moneyToCents(value: string): number | null {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents > 0 && cents <= 999999999 ? cents : null;
}
