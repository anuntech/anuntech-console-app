import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MailIcon } from "lucide-react";
import { getActor, type Actor } from "@/lib/access/access";
import { mailConfigured, MailMethodError, MailUnavailable } from "@/lib/mail/jmap";
import { listFolders, listMessages, mailboxAccess, mailboxesOf, readMessage } from "@/lib/mail/mailbox";
import { mailQuery, type MailQuery } from "@/lib/mail/mail-rules";
import { StatusPage } from "@/components/console/status-page";
import { MailView } from "@/components/email/mail-view";

export const metadata: Metadata = {
  title: "E-mail",
  description: "A sua caixa @anuntech.com dentro do Console.",
};

/**
 * The team's webmail. Only the Anuntech team, and only its own mailboxes:
 * anyone else, or another address, gets the same 404 as a page that does not
 * exist. The state lives in the URL (?caixa, ?pasta, ?q, ?pagina, ?msg).
 */
export default async function Email({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getActor();
  if (!actor.admin) notFound();
  const mailboxes = await mailboxesOf(actor);
  if (!mailboxes.length) notFound();
  if (!mailConfigured())
    return (
      <StatusPage
        layout="inline"
        icon={<MailIcon />}
        title="E-mail ainda não configurado neste ambiente"
        description="O Console ainda não tem acesso ao servidor de e-mail aqui. Na produção, a caixa abre nesta mesma tela."
      />
    );
  const query = mailQuery(await searchParams);
  const caixa = query.caixa || mailboxes[0];
  if (!mailboxes.includes(caixa)) notFound();
  const loaded = await load(actor, caixa, query);
  if (loaded.status === "denied") notFound();
  if (loaded.status === "unavailable")
    return (
      <StatusPage
        layout="inline"
        icon={<MailIcon />}
        title="O servidor de e-mail não respondeu"
        description="A caixa não abriu agora. Tente de novo em alguns minutos; se continuar, avise a equipe."
      />
    );
  if (loaded.status === "missing")
    return (
      <StatusPage
        layout="inline"
        icon={<MailIcon />}
        title="Essa caixa ainda não existe no servidor"
        description={`O endereço ${loaded.address} está na sua conta, mas não tem caixa no servidor de e-mail. Peça para a equipe criar a caixa.`}
      />
    );
  const { folders, folder, list, message } = loaded;
  return (
    <MailView
      data={{
        mailboxes,
        caixa,
        folders,
        folderId: folder?.id ?? "",
        rows: list.rows,
        total: list.total,
        query: { ...query, caixa, pasta: folder?.id ?? "" },
        message,
        now: new Date().toISOString(),
      }}
    />
  );
}

/** Everything the page shows from the mail server, or why it cannot. */
async function load(actor: Actor, caixa: string, query: MailQuery) {
  try {
    const access = await mailboxAccess(actor, caixa);
    if (access.status !== "open") return access;
    const mailbox = access.mailbox;
    const folders = await listFolders(mailbox);
    const folder = folders.find((f) => f.id === query.pasta) ?? folders.find((f) => f.role === "inbox") ?? folders[0];
    const [list, message] = await Promise.all([
      folder ? listMessages(mailbox, folder.id, { q: query.q, page: query.pagina }) : Promise.resolve({ rows: [], total: 0 }),
      query.msg ? readMessage(mailbox, query.msg) : Promise.resolve(null),
    ]);
    return { status: "open" as const, folders, folder, list, message };
  } catch (error) {
    if (error instanceof MailUnavailable || error instanceof MailMethodError) return { status: "unavailable" as const };
    throw error;
  }
}
