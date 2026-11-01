import { queryClient } from "./api";

/** The query of one company's mailboxes (mail.mailboxes), by the domain shown; the mailbox screen reads the same. */
export const mailKey = (company: string, domain?: string) => ["mail", company, domain ?? ""] as const;

/** After a password change: every list of mailboxes reads again. */
export const refreshMail = () => queryClient.invalidateQueries({ queryKey: ["mail"] });

const GIB = 1024 ** 3;

/** "320 MB", "1,4 GB", "5 GB": the web's storageLabel, in the binary units the mail server uses. */
export function storageLabel(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < GIB) return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
  const gb = bytes / GIB;
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1).replace(".", ",")} GB`;
}

/** "1,2 GB de 5 GB" and how full it is (null without a limit), as the web's bar. */
export function quotaLine(used: number, quota: number | null) {
  if (!quota) return { label: `${storageLabel(used)} usados`, percent: null };
  const percent = Math.min(100, Math.max(0, Math.round((used / quota) * 100)));
  return { label: `${storageLabel(used)} de ${storageLabel(quota)}`, percent };
}

/** The Apple profile's file name, as the web's mobileconfigFileName. */
export const profileFileName = (address: string) =>
  `email-${address.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.mobileconfig`;
