export type SecurityChannel = "email" | "whatsapp";
export function secondaryChannel(
  path: string,
  preferred: SecurityChannel,
): SecurityChannel {
  if (path === "/sign-in/email-otp") return "whatsapp";
  if (path === "/phone-number/verify") return "email";
  return preferred;
}
export function isPrimarySignIn(path: string) {
  return (
    path === "/sign-in/email-otp" ||
    path === "/phone-number/verify" ||
    path === "/sign-in/social" ||
    path.startsWith("/callback/")
  );
}
export function maskDestination(channel: SecurityChannel, value: string) {
  if (channel === "whatsapp") return `•••• ${value.slice(-4)}`;
  const [local, domain] = value.split("@");
  return `${local.slice(0, 2)}•••@${domain}`;
}
