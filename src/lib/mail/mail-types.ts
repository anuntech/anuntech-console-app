/** What the e-mail screens receive from the server (lib/mail/mail-admin.ts). No secrets, ever. */

export type MailboxRow = {
  /** The server's account id: every action looks it up again before changing anything. */
  id: string;
  address: string;
  local: string;
  domain: string;
  /** The account's description: the person's or the team's name. */
  name: string | null;
  usedBytes: number;
  /** null: no limit set on the server. */
  quotaBytes: number | null;
  /** Other local parts of the same domain that land here. */
  aliases: string[];
  createdAt: string | null;
  /** False for administrators and accounts with a custom role: they are listed, never changed here. */
  managed: boolean;
  /** The address (or an alias) is one of the signed-in person's own e-mails. */
  own?: boolean;
};

export type ForwardRow = {
  id: string;
  address: string;
  local: string;
  domain: string;
  name: string | null;
  recipients: string[];
  aliases: string[];
};
