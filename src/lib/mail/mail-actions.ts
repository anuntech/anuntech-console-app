"use server";
import { z } from "zod";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { auditEvents } from "@/db/schema";
import { reserveHourly } from "../http/hourly-limit";
import { MailMethodError, MailUnavailable } from "./jmap";
import { destroyFromTrash, moveMessage, openMailbox, sendMessage, setKeyword } from "./mailbox";
import {
  JMAP_ID,
  MAIL_BODY_MAX,
  MAIL_MAX_ATTACHMENTS,
  MAIL_MAX_RECIPIENTS,
  MAIL_SENDS_PER_HOUR,
  MAIL_TOTAL_ATTACHMENT_BYTES,
  MOVE_TARGETS,
  MOVED_TO,
  mailHref,
  parseAddressList,
  safeFileName,
} from "./mail-rules";

/*
 * The webmail's forms. Each one starts with getActor() and openMailbox(),
 * which checks that the mailbox is one of the person's own before anything
 * reaches the mail server. A mailbox outside that answers like one that does
 * not exist.
 */

const NO_MAILBOX = "Não encontramos essa caixa de e-mail.";
const NO_MESSAGE = "Essa mensagem não está mais nesta caixa. Atualize a página.";
const UNAVAILABLE = "O servidor de e-mail não respondeu. Tente de novo em alguns minutos.";

const id = z.string().regex(JMAP_ID);
/** Where the list was, to go back to it after the message leaves the folder. */
const place = {
  caixa: z.string().trim().toLowerCase().max(254),
  pasta: z.union([id, z.literal("")]).optional().default(""),
  q: z.string().max(160).optional().default(""),
  pagina: z.coerce.number().int().min(1).max(10_000).optional().default(1),
};
const messageForm = z.object({ ...place, id });

function failure(error: unknown): ActionState {
  if (error instanceof MailMethodError && ["notFound", "noRole"].includes(error.type)) return { error: NO_MESSAGE };
  if (error instanceof MailUnavailable || error instanceof MailMethodError) return { error: UNAVAILABLE };
  throw error;
}

async function messageAction(form: FormData) {
  const actor = await getActor();
  const parsed = messageForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: NO_MESSAGE } as const;
  const mailbox = await openMailbox(actor, parsed.data.caixa);
  if (!mailbox) return { error: NO_MAILBOX } as const;
  return { actor, mailbox, data: parsed.data };
}

/** Back to the folder, without the message open (opening it would mark it read again). */
const listOf = (data: z.infer<typeof messageForm>, single: boolean) =>
  mailHref({ caixa: data.caixa, pasta: data.pasta, q: data.q, pagina: data.pagina }, { single });

export async function markUnread(_: ActionState, form: FormData): Promise<ActionState> {
  const ready = await messageAction(form);
  if ("error" in ready) return { error: ready.error };
  try {
    await setKeyword(ready.mailbox, ready.data.id, "$seen", false);
  } catch (error) {
    return failure(error);
  }
  return { success: "Marcada como não lida.", href: listOf(ready.data, form.get("single") === "1") };
}

export async function starEmail(_: ActionState, form: FormData): Promise<ActionState> {
  const ready = await messageAction(form);
  if ("error" in ready) return { error: ready.error };
  const on = form.get("estrela") === "1";
  try {
    await setKeyword(ready.mailbox, ready.data.id, "$flagged", on);
  } catch (error) {
    return failure(error);
  }
  return { success: on ? "Estrela adicionada." : "Estrela removida." };
}

/** Arquivar, Spam, Lixeira or back to the Entrada. */
export async function moveEmail(_: ActionState, form: FormData): Promise<ActionState> {
  const ready = await messageAction(form);
  if ("error" in ready) return { error: ready.error };
  const target = z.enum(MOVE_TARGETS).safeParse(form.get("destino"));
  if (!target.success) return { error: NO_MESSAGE };
  try {
    await moveMessage(ready.mailbox, ready.data.id, target.data);
  } catch (error) {
    return failure(error);
  }
  return { success: MOVED_TO[target.data], href: listOf(ready.data, form.get("single") === "1") };
}

/** Deletes for good; only a message already in the Lixeira. */
export async function deleteForever(_: ActionState, form: FormData): Promise<ActionState> {
  const ready = await messageAction(form);
  if ("error" in ready) return { error: ready.error };
  try {
    if (!(await destroyFromTrash(ready.mailbox, ready.data.id)))
      return { error: "Só dá para excluir de vez uma mensagem que está na Lixeira." };
  } catch (error) {
    return failure(error);
  }
  return { success: "Mensagem excluída.", href: listOf(ready.data, form.get("single") === "1") };
}

const messageIds = z
  .string()
  .max(25_000)
  .optional()
  .default("[]")
  .transform((text, ctx) => {
    try {
      return z.array(z.string().regex(/^[^\s<>]{1,998}$/)).max(20).parse(JSON.parse(text));
    } catch {
      ctx.addIssue({ code: "custom", message: "references" });
      return z.NEVER;
    }
  });
const attachmentList = z
  .string()
  .max(100_000)
  .optional()
  .default("[]")
  .transform((text, ctx) => {
    try {
      return z
        .array(
          z.object({
            blobId: id,
            name: z.string().max(255).transform((name) => safeFileName(name)),
            type: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/).max(127).catch("application/octet-stream"),
            size: z.number().int().min(0).max(MAIL_TOTAL_ATTACHMENT_BYTES),
          }),
        )
        .max(MAIL_MAX_ATTACHMENTS)
        .parse(JSON.parse(text));
    } catch {
      ctx.addIssue({ code: "custom", message: "attachments" });
      return z.NEVER;
    }
  });

const sendForm = z.object({
  caixa: place.caixa,
  para: z.string().max(10_000).optional().default(""),
  cc: z.string().max(10_000).optional().default(""),
  cco: z.string().max(10_000).optional().default(""),
  assunto: z.string().max(998).optional().default(""),
  corpo: z.string().max(MAIL_BODY_MAX, "O texto passa do limite de 200 mil caracteres.").optional().default(""),
  anexos: attachmentList,
  inReplyTo: messageIds,
  references: messageIds,
});

const FIELD_NAMES = { para: "Para", cc: "Cc", cco: "Cco" } as const;

/** Writes, replies and forwards: plain text from the mailbox's address, with the person's name. */
export async function sendEmail(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const parsed = sendForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "anexos") return { error: "Os anexos não chegaram inteiros. Tire e anexe de novo." };
    if (issue?.path[0] === "corpo") return { error: issue.message };
    if (issue?.path[0] === "assunto") return { error: "O assunto está longo demais." };
    return { error: "Não foi possível ler a mensagem. Recarregue a página e tente de novo." };
  }
  const data = parsed.data;
  const mailbox = await openMailbox(actor, data.caixa);
  if (!mailbox) return { error: NO_MAILBOX };
  const lists = { para: data.para, cc: data.cc, cco: data.cco };
  const recipients: Record<keyof typeof lists, { name?: string | null; email: string }[]> = { para: [], cc: [], cco: [] };
  for (const field of Object.keys(lists) as (keyof typeof lists)[]) {
    const result = parseAddressList(lists[field]);
    if (!result.ok) return { error: `Confira o endereço “${result.invalid}” em ${FIELD_NAMES[field]}.` };
    recipients[field] = result.addresses;
  }
  if (!recipients.para.length) return { error: "Escreva pelo menos um endereço em Para." };
  const count = recipients.para.length + recipients.cc.length + recipients.cco.length;
  if (count > MAIL_MAX_RECIPIENTS) return { error: `Uma mensagem vai para até ${MAIL_MAX_RECIPIENTS} endereços.` };
  if (data.anexos.reduce((sum, a) => sum + a.size, 0) > MAIL_TOTAL_ATTACHMENT_BYTES)
    return { error: "Os anexos passam de 25 MB no total. Tire algum e envie de novo." };
  try {
    if (!(await reserveHourly("email.send", actor.user.id, MAIL_SENDS_PER_HOUR)))
      return { error: `Você chegou a ${MAIL_SENDS_PER_HOUR} envios nesta hora. Espere um pouco para enviar de novo.` };
  } catch (error) {
    if (logDatabaseFault("email", error)) return { error: UNAVAILABLE };
    throw error;
  }
  let emailId: string;
  try {
    emailId = await sendMessage(mailbox, {
      fromName: actor.user.name?.trim() || mailbox.address,
      to: recipients.para,
      cc: recipients.cc,
      bcc: recipients.cco,
      // One line: a line break in the subject would start another header.
      subject: data.assunto.replace(/[\u0000-\u001f\u007f]+/g, " ").trim(),
      body: data.corpo.replace(/\r\n?/g, "\n"),
      inReplyTo: data.inReplyTo,
      references: data.references,
      attachments: data.anexos,
    });
  } catch (error) {
    if (error instanceof MailUnavailable && error.uncertain)
      return { error: "O servidor de e-mail demorou a responder e não sabemos se a mensagem saiu. Confira em Enviados antes de mandar de novo." };
    if (error instanceof MailMethodError && error.method === "EmailSubmission/set")
      return { error: "O servidor recusou o envio. A mensagem ficou em Rascunhos; confira os endereços e tente de novo." };
    return failure(error);
  }
  // The record says a message went out and to how many; never what it said or to whom.
  try {
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: null,
      action: "email.sent",
      entityId: emailId,
      details: { mailbox: mailbox.address, recipients: count, attachments: data.anexos.length },
    });
  } catch (error) {
    // The message is already out: the person reads the success either way.
    if (!logDatabaseFault("email", error)) console.error("[email] audit failed");
  }
  return { success: "E-mail enviado." };
}
