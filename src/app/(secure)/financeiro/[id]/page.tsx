import { paymentUrl } from "@/lib/payment-link";
import { issueDate } from "@/lib/recurrence";
import {
  sendInvoiceNotice,
  changePaymentLink,
  changeSubscription,
  updateSubscription,
} from "@/lib/billing-public-actions";
import { DownloadLink } from "@/components/download-link";
import Link from "next/link";
import { addressLabel } from "@/lib/company-billing";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  invoices,
  companies,
  subscriptions,
  billingNotices,
} from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { cancelDraft, updateDraft } from "@/lib/actions";
import { issueCharge, syncCharge } from "@/lib/billing-actions";
import { ActionForm } from "@/components/action-form";
import { InvoiceAmount, InvoiceDueDate } from "@/components/invoice-inputs";
import { Heading, Back, Badge, Field } from "@/components/ui";
import { invoiceLabels, currency, dateLabel } from "@/lib/format";
export default async function Invoice({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({ invoice: invoices, company: companies })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .where(eq(invoices.id, id));
  if (
    !row ||
    !canAccess(actor, row.invoice.companyId, "finance") ||
    (!actor.admin && !["issued", "paid"].includes(row.invoice.status))
  )
    notFound();
  const i = row.invoice;
  const sub = i.subscriptionId
    ? (
        await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, i.subscriptionId))
      )[0]
    : null;
  const scheduled = i.status === "draft" && sub?.status === "active";
  const notices = actor.admin
    ? await db
        .select()
        .from(billingNotices)
        .where(eq(billingNotices.invoiceId, i.id))
    : [];
  const noticeStatus = {
    waiting: "Aguardando processamento",
    sending: "Enviando",
    uncertain: "Envio sem confirmação: conferir no provedor",
    pending: "Envio pendente",
    accepted: "Aceito pelo provedor; aguardando entrega",
    delivered: "Entrega confirmada pelo provedor",
    failed: "Falha no envio",
    expired: "Revisão necessária",
    skipped: "Envio interrompido",
  };
  return (
    <>
      <Back href="/financeiro" label="Financeiro" />
      <Heading title="Detalhes da fatura" description={row.company.name} />
      <section className="panel padded invoice-detail">
        <div className="card-top">
          <Badge status={i.status}>
            {scheduled ? "Agendada" : invoiceLabels[i.status]}
          </Badge>
          <span className="muted">Vencimento: {dateLabel(i.dueDate)}</span>
        </div>
        <p className="invoice-amount">{currency(i.amountCents)}</p>
        <p className="pre-wrap">{i.description}</p>
        {actor.admin &&
          typeof i.bankRequest?.dataVencimento === "string" &&
          i.bankRequest.dataVencimento !== i.dueDate && (
            <p className="muted">
              Vencimento confirmado pelo Inter: {dateLabel(i.dueDate)}. Data
              solicitada: {dateLabel(i.bankRequest.dataVencimento)}.
            </p>
          )}
        <p className="muted">
          {sub
            ? `Cobrança recorrente · ${sub.interval === "monthly" ? "Mensal" : "Anual"}`
            : "Cobrança única"}
        </p>
        {actor.admin && sub && (
          <section className="edit-details">
            <h2>Recorrência</h2>
            <p>
              Situação:{" "}
              {
                {
                  draft: "Aguardando publicação",
                  active: "Ativa",
                  paused: "Pausada",
                  cancelled: "Cancelada",
                }[sub.status]
              }
            </p>
            <p>
              Próximo vencimento: {dateLabel(sub.nextDueDate)} · Emissão e
              avisos: {dateLabel(issueDate(sub.nextDueDate, sub.leadDays))}
            </p>
            <p className="muted">
              {currency(sub.amountCents)} · {sub.description}. Emissão e envio
              por e-mail e WhatsApp 5 dias antes de cada vencimento.
            </p>
            {sub.status !== "cancelled" && (
              <details className="edit-details">
                <summary>Editar próximas cobranças</summary>
                <ActionForm
                  action={updateSubscription}
                  label="Salvar recorrência"
                >
                  <input type="hidden" name="id" value={sub.id} />
                  <Field label="Produto">
                    <textarea
                      name="description"
                      required
                      maxLength={1000}
                      defaultValue={sub.description}
                    />
                  </Field>
                  <InvoiceAmount defaultCents={sub.amountCents} />
                  <InvoiceDueDate defaultValue={sub.nextDueDate} />
                  <p className="muted">
                    A alteração vale para os próximos períodos. Faturas já
                    emitidas permanecem preservadas.
                  </p>
                </ActionForm>
              </details>
            )}
            {sub.lastError && <p role="alert">{sub.lastError}</p>}
            {["active", "paused"].includes(sub.status) && (
              <ActionForm
                action={changeSubscription}
                label={
                  sub.status === "active"
                    ? "Pausar recorrência"
                    : "Retomar recorrência"
                }
                className="compact-form"
              >
                <input type="hidden" name="id" value={sub.id} />
                <input
                  type="hidden"
                  name="status"
                  value={sub.status === "active" ? "paused" : "active"}
                />
              </ActionForm>
            )}
          </section>
        )}
        {actor.admin && ["issued", "paid"].includes(i.status) && (
          <section className="edit-details">
            <h2>Link público de pagamento</h2>
            {i.publicId && i.publicEnabled ? (
              <p>
                <a
                  href={paymentUrl(i.publicId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir página de pagamento
                </a>
              </p>
            ) : (
              <p className="muted">
                O link público está desativado ou ainda não foi gerado.
              </p>
            )}
            {i.publicId && i.publicEnabled && (
              <Field label="Link para compartilhar">
                <input readOnly value={paymentUrl(i.publicId)} />
              </Field>
            )}
            <ActionForm
              action={changePaymentLink}
              label={
                i.publicId && i.publicEnabled
                  ? "Desativar link público"
                  : "Ativar link público"
              }
              className="compact-form"
            >
              <input type="hidden" name="id" value={i.id} />
              <input
                type="hidden"
                name="enabled"
                value={i.publicId && i.publicEnabled ? "no" : "yes"}
              />
            </ActionForm>
            <h2>Avisos de cobrança</h2>
            <p>
              E-mail: {row.company.billingEmail} · WhatsApp:{" "}
              {row.company.phone || "Não cadastrado"}
            </p>
            <p className="muted">
              Nova cobrança, aviso no vencimento e até 5 lembretes de atraso: 5,
              10, 15, 20 e 25 dias. Os envios param após a confirmação do
              pagamento. WhatsApp depende da aprovação dos modelos.
            </p>
            {notices.map((notice) => (
              <p key={notice.id}>
                <strong>
                  {notice.channel === "email" ? "E-mail" : "WhatsApp"} ·{" "}
                  {notice.kind === "initial"
                    ? "Nova cobrança"
                    : notice.kind === "due"
                      ? "Vence hoje"
                      : `${notice.kind.replace("overdue_", "")} dias de atraso`}
                </strong>
                : {noticeStatus[notice.status]}
                {notice.error ? ` — ${notice.error}` : ""}
              </p>
            ))}
            {(["email", "whatsapp"] as const).map((channel) => {
              const notice = notices.find(
                (n) => n.kind === "initial" && n.channel === channel,
              );
              return i.status === "issued" &&
                i.publicEnabled &&
                (!notice ||
                  (notice.status === "failed" && notice.attempts === 0)) ? (
                <ActionForm
                  key={channel}
                  action={sendInvoiceNotice}
                  label={`Enviar cobrança por ${channel === "email" ? "e-mail" : "WhatsApp"}`}
                  className="compact-form"
                >
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="channel" value={channel} />
                </ActionForm>
              ) : null;
            })}
            <p className="muted">
              A confirmação de entrega é consultada automaticamente no Resend e
              no Synova. Entrega ao servidor de e-mail não comprova leitura ou
              chegada à caixa principal.
            </p>
          </section>
        )}
        <hr />
        <h2>Pagamento</h2>
        <p className="muted">
          {scheduled
            ? `Cobrança agendada para emissão em ${dateLabel(issueDate(i.dueDate, sub!.leadDays))}. Os avisos serão enviados após a emissão.`
            : i.status === "draft"
              ? "Esta fatura é um rascunho. Nenhuma cobrança foi emitida."
              : i.status === "cancelled"
                ? "Esta fatura foi cancelada."
                : i.status === "paid"
                  ? "Pagamento confirmado."
                  : "Consulte os dados de pagamento abaixo. A atualização é feita pela equipe da Anuntech."}
        </p>
        {i.status === "issued" && i.pixCopyPaste && (
          <Field label="Pix copia e cola">
            <textarea readOnly value={i.pixCopyPaste} />
          </Field>
        )}
        {i.status === "issued" && i.boletoLine && (
          <>
            <Field label="Linha digitável">
              <input readOnly value={i.boletoLine} />
            </Field>
            <DownloadLink
              className="button primary"
              href={`/api/boletos/${i.id}`}
            >
              Baixar boleto PDF
            </DownloadLink>
          </>
        )}
        {actor.admin && i.bankRequest && (
          <>
            <p className="muted">
              Situação no Inter: {i.bankStatus}.{" "}
              {i.bankCheckedAt
                ? `Consulta: ${i.bankCheckedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                : "Aguardando consulta."}
            </p>
            <ActionForm action={syncCharge} label="Consultar cobrança no Inter">
              <input type="hidden" name="id" value={i.id} />
              {!i.providerId && (
                <>
                  <p>
                    Consulte a solicitação no Inter e informe o código para
                    reconciliar esta tentativa. Não crie outra cobrança antes de
                    verificar.
                  </p>
                  <Field label="Código da solicitação no Inter">
                    <input name="providerId" required />
                  </Field>
                </>
              )}
            </ActionForm>
          </>
        )}
        <h2>Nota fiscal</h2>
        <p className="muted">
          {i.fiscalStatus === "not_requested"
            ? "Emissão ainda não solicitada."
            : "Acompanhe a emissão com a equipe da Anuntech."}
        </p>
        {actor.admin && (
          <p className="muted">
            {row.company.autoIssueNfse
              ? "Este cliente está selecionado para nota fiscal automática. A emissão ainda depende da conclusão da integração fiscal."
              : "Nota fiscal automática desativada para este cliente."}{" "}
            <Link href={`/empresas/${i.companyId}#cadastro`}>
              Configurar no cadastro do cliente
            </Link>
            .
          </p>
        )}
        {actor.admin && i.status === "draft" && !i.bankRequest && (
          <>
            <details className="edit-details">
              <summary>
                {sub
                  ? "Publicar cobrança recorrente"
                  : "Publicar cobrança única"}
              </summary>
              <p>
                A cobrança usa os dados salvos no cadastro do cliente. Cobranças
                únicas são emitidas agora; recorrentes são agendadas para 5 dias
                antes do vencimento. O Pix depende de uma chave cadastrada na
                conta.
              </p>
              <ActionForm
                action={issueCharge}
                label={
                  sub
                    ? "Publicar cobrança recorrente"
                    : "Publicar cobrança no Inter"
                }
              >
                <input type="hidden" name="id" value={i.id} />
                <div>
                  <strong>
                    {row.company.name} · {row.company.document}
                  </strong>
                  <p>
                    {row.company.billingAddress
                      ? addressLabel(row.company.billingAddress)
                      : "Complete o endereço no cadastro do cliente antes de emitir a cobrança."}
                  </p>
                  <Link href={`/empresas/${i.companyId}#cadastro`}>
                    Editar cadastro do cliente
                  </Link>
                </div>
                <Field label="Dias após vencimento até cancelamento no banco">
                  <input
                    name="numDiasAgenda"
                    type="number"
                    min={0}
                    max={60}
                    defaultValue={30}
                    required
                  />
                </Field>
                {sub ? (
                  <label className="checkbox-field">
                    <input
                      name="activateRecurring"
                      type="checkbox"
                      value="yes"
                      required
                    />
                    Confirmo a recorrência{" "}
                    {sub.interval === "monthly" ? "mensal" : "anual"}, com
                    emissão e avisos por e-mail e WhatsApp 5 dias antes do
                    vencimento.
                  </label>
                ) : (
                  <label className="checkbox-field">
                    <input
                      name="sendNotifications"
                      type="checkbox"
                      value="yes"
                      defaultChecked
                    />
                    Enviar e-mail e WhatsApp com o link público quando os dados
                    de pagamento estiverem disponíveis e os lembretes previstos.
                  </label>
                )}
                <label className="checkbox-field">
                  <input name="confirm" type="checkbox" value="yes" required />{" "}
                  Conferi o valor, vencimento e pagador e confirmo a emissão no
                  Inter.
                </label>
              </ActionForm>
            </details>
            <details className="edit-details">
              <summary>Editar rascunho</summary>
              <ActionForm action={updateDraft} label="Salvar alterações">
                <input type="hidden" name="id" value={i.id} />
                <Field label="Descrição">
                  <textarea
                    name="description"
                    required
                    maxLength={1000}
                    defaultValue={i.description}
                  />
                </Field>
                <InvoiceAmount defaultCents={i.amountCents} />
                <InvoiceDueDate defaultValue={i.dueDate} />
              </ActionForm>
            </details>
            <ActionForm
              action={cancelDraft}
              label="Cancelar rascunho"
              danger
              className="compact-form"
            >
              <input type="hidden" name="id" value={i.id} />
            </ActionForm>
          </>
        )}
      </section>
    </>
  );
}
