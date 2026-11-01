import "server-only";
import { areaMailboxes, mailArea } from "../../mail/mail-area";
import { MAIL_CLIENT_HOST, MAIL_PORTS } from "../../mail/mail-rules";
import { blocked, notFound, resetPassword } from "../../mail/mail-service";
import { api } from "../server";
import { guard, missing } from "../access";
import { refuse } from "../managed-company";

/*
 * The company's e-mail in the app, opened by the e-mail product: the list of
 * mailboxes and the password. The rules are the web's (lib/mail): the team
 * and the Administrador see every mailbox of the company's domains, a Membro
 * only their own; creating, editing, deleting, forwards and the DNS stay on
 * the web (mobile/task.md).
 */
export const mail = {
  mailboxes: api.mail.mailboxes
    .use(guard({ area: "overview", company: ({ companyId }) => companyId }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const area = await mailArea(actor, { empresa: input.companyId, dominio: input.domain });
      // A domain of another of the person's companies is not this company's: it does not exist here.
      if (!area || area.companyId !== input.companyId) throw missing();
      const rows = area.current ? await areaMailboxes(actor, area) : [];
      return {
        company: area.companyName,
        role: area.role,
        domains: area.choices.map((choice) => choice.domain),
        domain: area.role === "member" ? null : (area.current?.domain ?? null),
        mailboxes: rows.map((row) => ({
          id: row.id,
          address: row.address,
          name: row.name,
          usedBytes: row.usedBytes,
          quotaBytes: row.quotaBytes,
          aliases: row.aliases,
          managed: row.managed,
          own: !!row.own,
        })),
        setup: { host: MAIL_CLIENT_HOST, imapPort: MAIL_PORTS.imap.port, smtpPort: MAIL_PORTS.smtp.port, smtpStarttlsPort: MAIL_PORTS.smtpStarttls.port },
      };
    }),
  resetPassword: api.mail.resetPassword
    // resetPassword reads the mailbox back from the server and checks it against its company and the person's role.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const result = await resetPassword(context.actor, input);
      // Out of reach (another company, someone else's mailbox, no company at all) reads as not found, like guard().
      if ("error" in result) throw result.error === notFound.error || result.error === blocked.error ? missing() : refuse(result.error ?? "Não foi possível trocar a senha.");
      return { message: result.success ?? "Senha trocada.", address: result.address ?? "", ...(result.password ? { password: result.password } : {}) };
    }),
};
