import { DownloadLink } from "@/components/download-link";
import { Notification } from "@/components/notifications";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  tickets,
  messages,
  user,
  companies,
  attachments,
  engagements,
} from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { replyTicket, updateTicket, uploadAttachment } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { Heading, Field, Back, Badge } from "@/components/ui";
import { ticketLabels, dateLabel } from "@/lib/format";
import { Paperclip, MessagesSquare, SlidersHorizontal } from "lucide-react";
export default async function Ticket({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({
      ticket: tickets,
      company: companies.name,
      engagement: engagements.name,
    })
    .from(tickets)
    .innerJoin(companies, eq(companies.id, tickets.companyId))
    .leftJoin(engagements, eq(engagements.id, tickets.engagementId))
    .where(eq(tickets.id, id));
  if (!row || !canAccess(actor, row.ticket.companyId, "support")) notFound();
  const [thread, files] = await Promise.all([
    db
      .select({ message: messages, name: user.name })
      .from(messages)
      .innerJoin(user, eq(user.id, messages.authorId))
      .where(eq(messages.ticketId, id))
      .orderBy(asc(messages.createdAt)),
    db
      .select({
        id: attachments.id,
        name: attachments.name,
        size: attachments.size,
      })
      .from(attachments)
      .where(eq(attachments.ticketId, id)),
  ]);
  const t = row.ticket;
  return (
    <>
      <Back href="/chamados" label="Chamados" />
      <Heading
        title={t.subject}
        description={`${row.company}${row.engagement ? ` · ${row.engagement}` : ""}`}
      />
      <div className="ticket-layout">
        <section>
          <div className="panel padded">
            <div className="card-top">
              <Badge status={t.status}>{ticketLabels[t.status]}</Badge>
              <small className="muted">
                Aberto em {dateLabel(t.createdAt)}
              </small>
            </div>
            <h2 className="detail-section-title">
              <MessagesSquare size={18} aria-hidden="true" />
              Conversa
            </h2>
            <div className="thread">
              {thread.map(({ message: m, name }) => (
                <article className="message" key={m.id}>
                  <div className="message-meta">
                    <span className="message-author">
                      <span className="message-avatar" aria-hidden="true">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                      <strong>{name}</strong>
                    </span>
                    <time>{dateLabel(m.createdAt)}</time>
                  </div>
                  <p className="pre-wrap">{m.body}</p>
                </article>
              ))}
            </div>
            {t.status !== "closed" ? (
              <ActionForm
                action={replyTicket}
                label="Enviar resposta"
                reset
                className="form message-reply"
              >
                <input type="hidden" name="ticketId" value={id} />
                <Field label="Sua resposta">
                  <textarea
                    name="body"
                    required
                    rows={5}
                    maxLength={10000}
                    placeholder="Escreva sua resposta para continuar a conversa."
                  />
                </Field>
              </ActionForm>
            ) : (
              <Notification
                message="Este chamado foi encerrado."
                id="ticket-closed"
              />
            )}
          </div>
        </section>
        <aside className="details-column">
          {actor.admin && (
            <section className="panel padded">
              <h2 className="detail-section-title">
                <SlidersHorizontal size={17} aria-hidden="true" />
                Gerenciar chamado
              </h2>
              <ActionForm action={updateTicket} label="Atualizar">
                <input type="hidden" name="ticketId" value={id} />
                <Field label="Situação">
                  <select name="status" defaultValue={t.status}>
                    {Object.entries(ticketLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Responsável (e-mail)">
                  <input
                    name="assignedTo"
                    type="email"
                    defaultValue={t.assignedTo || ""}
                  />
                </Field>
              </ActionForm>
            </section>
          )}
          <section className="panel padded">
            <h2 className="detail-section-title">
              <Paperclip size={17} aria-hidden="true" />
              Anexos <span className="collection-count">{files.length}</span>
            </h2>
            <p className="muted">
              PDF, PNG ou JPEG. Até 1 MB por arquivo e 20 arquivos por chamado.
            </p>
            <div className="attachment-list">
              {!files.length && (
                <p className="form-footnote">Nenhum arquivo anexado.</p>
              )}
              {files.map((f) => (
                <DownloadLink
                  key={f.id}
                  href={`/api/anexos/${f.id}`}
                  filename={f.name}
                >
                  <Paperclip size={15} />
                  <span>
                    {f.name}
                    <small>{Math.ceil(f.size / 1024)} KB</small>
                  </span>
                </DownloadLink>
              ))}
            </div>
            {t.status !== "closed" && (
              <ActionForm
                action={uploadAttachment}
                label="Adicionar arquivo"
                reset
              >
                <input type="hidden" name="ticketId" value={id} />
                <Field label="Arquivo">
                  <input
                    name="file"
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg"
                  />
                </Field>
              </ActionForm>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
