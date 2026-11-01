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
  /** The client the domain is linked to; null on Anuntech's own. */
  companyId: string | null;
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
  companyId: string | null;
};

/** A managed domain on E-mail › Domínios. */
export type DomainRow = {
  domain: string;
  /** The link's id (console_mail_domains); null on Anuntech's own. */
  linkId: string | null;
  companyId: string | null;
  /** "Anuntech" on its own domains. */
  companyName: string;
  /** False when the link exists but the server no longer has the domain. */
  onServer: boolean;
};
