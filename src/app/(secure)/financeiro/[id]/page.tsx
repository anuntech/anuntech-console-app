import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Info,
  Link2,
  Mail,
  MessageCircle,
  ReceiptText,
  Repeat2,
  Send,
} from "lucide-react";
import styles from "../finance.module.css";
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
import { FormModal } from "@/components/form-modal";
export const metadata = {
  title: "Detalhes da fatura",
  description: "Consulte o pagamento, os avisos e as condições desta fatura.",
};
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
      <section className={styles.summary} aria-label="Resumo da fatura">
        <div className={styles.summaryTop}>
          <div>
            <Badge status={scheduled ? "scheduled" : i.status}>
              {scheduled ? "Agendada" : invoiceLabels[i.status]}
            </Badge>
            <h2 className={styles.summaryProduct}>{i.description}</h2>
            <p className="muted">{row.company.name}</p>
          </div>
          <div className={styles.amount}>
            <span>Valor da fatura</span>
            <strong>{currency(i.amountCents)}</strong>
          </div>
        </div>
        <div className={styles.summaryBottom}>
          <div>
            <CalendarDays size={18} aria-hidden="true" />
            <div>
              <span>Vencimento</span>
              <strong>{dateLabel(i.dueDate)}</strong>
            </div>
          </div>
          <div>
            <Repeat2 size={18} aria-hidden="true" />
            <div>
              <span>Tipo de cobrança</span>
              <strong>
                {sub
                  ? `Recorrente · ${sub.interval === "monthly" ? "Mensal" : "Anual"}`
                  : "Cobrança única"}
              </strong>
            </div>
          </div>
        </div>
      </section>
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span
                className={`${styles.icon} ${i.status === "paid" ? styles.success : ""}`}
              >
                {i.status === "paid" ? (
                  <CheckCircle2 size={18} aria-hidden="true" />
                ) : (
                  <CreditCard size={18} aria-hidden="true" />
                )}
              </span>
              <div>
                <h2>Pagamento</h2>
                <p>
                  {i.status === "paid"
                    ? "Pagamento confirmado pelo banco."
                    : "Dados e situação desta cobrança."}
                </p>
              </div>
            </div>
            <div className={styles.note}>
              <Info size={17} aria-hidden="true" />
              <p>
                {scheduled
                  ? `Cobrança agendada para emissão em ${dateLabel(issueDate(i.dueDate, sub!.leadDays))}. Os avisos serão enviados após a emissão.`
                  : i.status === "draft"
                    ? "Esta fatura é um rascunho. Nenhuma cobrança foi emitida."
                    : i.status === "cancelled"
                      ? "Esta fatura foi cancelada."
                      : i.status === "paid"
                        ? "Pagamento confirmado. Os avisos de cobrança foram interrompidos."
                        : "Consulte os dados de pagamento abaixo. A confirmação é realizada pelo Inter."}
              </p>
            </div>
            {actor.admin &&
              typeof i.bankRequest?.dataVencimento === "string" &&
              i.bankRequest.dataVencimento !== i.dueDate && (
                <p className={styles.helpText}>
                  Vencimento confirmado pelo Inter: {dateLabel(i.dueDate)}. Data
                  solicitada: {dateLabel(i.bankRequest.dataVencimento)}.
                </p>
              )}
            {i.status === "issued" && (i.pixCopyPaste || i.boletoLine) && (
              <div className={`${styles.draftSection} stack`}>
                {i.pixCopyPaste && (
                  <Field label="Pix copia e cola">
                    <textarea readOnly value={i.pixCopyPaste} rows={3} />
                  </Field>
                )}
                {i.boletoLine && (
                  <>
                    <Field label="Linha digitável">
                      <input readOnly value={i.boletoLine} />
                    </Field>
                    <DownloadLink
                      className="button primary"
                      href={`/api/boletos/${i.id}`}
                    >
                      <FileText size={16} aria-hidden="true" />
                      Baixar boleto PDF
                    </DownloadLink>
                  </>
                )}
              </div>
            )}
            {actor.admin && i.bankRequest && (
              <div className={styles.bankNote}>
                <p className="muted">
                  Situação no Inter: {i.bankStatus}.{" "}
                  {i.bankCheckedAt
                    ? `Consulta: ${i.bankCheckedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                    : "Aguardando consulta."}
                </p>
                <ActionForm
                  action={syncCharge}
                  label="Consultar cobrança no Inter"
                >
                  <input type="hidden" name="id" value={i.id} />
                  {!i.providerId && (
                    <>
                      <p>
                        Consulte a solicitação no Inter e informe o código para
                        reconciliar esta tentativa. Não crie outra cobrança
                        antes de verificar.
                      </p>
                      <Field label="Código da solicitação no Inter">
                        <input name="providerId" required />
                      </Field>
                    </>
                  )}
                </ActionForm>
              </div>
            )}
          </section>
          {actor.admin && i.status === "draft" && !i.bankRequest && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.icon}>
                  <ReceiptText size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2>Revisão e publicação</h2>
                  <p>Confira os dados antes de ativar a cobrança.</p>
                </div>
              </div>
              <details className={styles.disclosure}>
                <summary>
                  {sub
                    ? "Publicar cobrança recorrente"
                    : "Publicar cobrança única"}
                </summary>
                <p>
                  A cobrança usa os dados salvos no cadastro do cliente.
                  Cobranças únicas são emitidas agora; recorrentes são agendadas
                  para 5 dias antes do vencimento. O Pix depende de uma chave
                  cadastrada na conta.
                </p>
                <ActionForm
                  action={issueCharge}
                  confirm={{
                    title: sub
                      ? "Publicar cobrança recorrente?"
                      : "Emitir cobrança no Inter?",
                    description: `${row.company.name}: ${currency(i.amountCents)}, com vencimento em ${dateLabel(i.dueDate)}. ${sub ? "A publicação ativa as próximas emissões e os avisos recorrentes." : "A confirmação solicita a emissão bancária e aplica a opção de avisos selecionada."}`,
                  }}
                  label={
                    sub
                      ? "Publicar cobrança recorrente"
                      : "Publicar cobrança no Inter"
                  }
                >
                  <input type="hidden" name="id" value={i.id} />
                  <div className={styles.note}>
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
                      Enviar e-mail e WhatsApp com o link público quando os
                      dados de pagamento estiverem disponíveis e os lembretes
                      previstos.
                    </label>
                  )}
                  <label className="checkbox-field">
                    <input
                      name="confirm"
                      type="checkbox"
                      value="yes"
                      required
                    />
                    Conferi o valor, vencimento e pagador e confirmo a emissão
                    no Inter.
                  </label>
                </ActionForm>
              </details>
              <FormModal
                trigger="Editar rascunho"
                title="Editar rascunho da fatura"
                description="Revise o produto, o valor e o vencimento. Salvar não emite a cobrança."
                action={updateDraft}
                label="Salvar alterações"
              >
                <input type="hidden" name="id" value={i.id} />
                <Field label="Descrição">
                  <textarea
                    name="description"
                    required
                    maxLength={1000}
                    defaultValue={i.description}
                  />
                </Field>
                <div className="form-grid">
                  <InvoiceAmount defaultCents={i.amountCents} />
                  <InvoiceDueDate defaultValue={i.dueDate} />
                </div>
              </FormModal>
              <ActionForm
                action={cancelDraft}
                confirm={{
                  title: "Cancelar este rascunho?",
                  description: `A fatura de ${currency(i.amountCents)} para ${row.company.name} será cancelada. Nenhuma cobrança bancária será emitida.`,
                }}
                label="Cancelar rascunho"
                danger
                className="compact-form"
              >
                <input type="hidden" name="id" value={i.id} />
              </ActionForm>
            </section>
          )}
          {actor.admin && ["issued", "paid"].includes(i.status) && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.icon}>
                  <Send size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2>Avisos de cobrança</h2>
                  <p>Acompanhe cada canal de comunicação com o cliente.</p>
                </div>
              </div>
              <div className={styles.contact}>
                <div>
                  <Mail size={16} aria-hidden="true" />
                  <span>E-mail: {row.company.billingEmail}</span>
                </div>
                <div>
                  <MessageCircle size={16} aria-hidden="true" />
                  <span>WhatsApp: {row.company.phone || "Não cadastrado"}</span>
                </div>
              </div>
              <p className={styles.helpText}>
                Nova cobrança, aviso no vencimento e até 5 lembretes de atraso:
                5, 10, 15, 20 e 25 dias. Os envios param após a confirmação do
                pagamento. WhatsApp depende da aprovação dos modelos.
              </p>
              {notices.length > 0 && (
                <ul className={styles.noticeList}>
                  {notices.map((notice) => (
                    <li key={notice.id} className={styles.noticeItem}>
                      {notice.channel === "email" ? (
                        <Mail size={17} aria-hidden="true" />
                      ) : (
                        <MessageCircle size={17} aria-hidden="true" />
                      )}
                      <div>
                        <strong>
                          {notice.channel === "email" ? "E-mail" : "WhatsApp"} ·{" "}
                          {notice.kind === "initial"
                            ? "Nova cobrança"
                            : notice.kind === "due"
                              ? "Vence hoje"
                              : `${notice.kind.replace("overdue_", "")} dias de atraso`}
                        </strong>
                        <span
                          className={styles.noticeBadge}
                          data-status={notice.status}
                        >
                          {noticeStatus[notice.status]}
                        </span>
                        {notice.error && <p>{notice.error}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
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
                    confirm={{
                      title: `Enviar cobrança por ${channel === "email" ? "e-mail" : "WhatsApp"}?`,
                      description: `O cliente ${row.company.name} receberá o aviso desta fatura de ${currency(i.amountCents)} com o link público de pagamento.`,
                    }}
                    label={`Enviar cobrança por ${channel === "email" ? "e-mail" : "WhatsApp"}`}
                    className="compact-form"
                  >
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="channel" value={channel} />
                  </ActionForm>
                ) : null;
              })}
              <p className={styles.helpText}>
                A confirmação de entrega é consultada automaticamente no Resend
                e no Synova. Entrega ao servidor de e-mail não comprova leitura
                ou chegada à caixa principal.
              </p>
            </section>
          )}
        </div>
        <aside className={styles.aside}>
          {actor.admin && ["issued", "paid"].includes(i.status) && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.icon}>
                  <Link2 size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2>Link público de pagamento</h2>
                  <p>Acesso direto, sem login.</p>
                </div>
              </div>
              {i.publicId && i.publicEnabled ? (
                <>
                  <a
                    className={`button secondary ${styles.publicLink}`}
                    href={paymentUrl(i.publicId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir página de pagamento
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>
                  <Field label="Link para compartilhar">
                    <input
                      className={styles.linkInput}
                      readOnly
                      value={paymentUrl(i.publicId)}
                    />
                  </Field>
                </>
              ) : (
                <p className={styles.helpText}>
                  O link público está desativado ou ainda não foi gerado.
                </p>
              )}
              <ActionForm
                action={changePaymentLink}
                confirm={{
                  title:
                    i.publicId && i.publicEnabled
                      ? "Desativar link público?"
                      : "Ativar link público?",
                  description:
                    i.publicId && i.publicEnabled
                      ? "O endereço compartilhado deixará de abrir esta fatura. A cobrança no banco permanece inalterada."
                      : "Pessoas com o endereço poderão consultar e pagar esta fatura sem login.",
                }}
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
            </section>
          )}
          {actor.admin && sub && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.icon}>
                  <Repeat2 size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2>Recorrência</h2>
                  <p>
                    {sub.interval === "monthly"
                      ? "Cobrança mensal"
                      : "Cobrança anual"}
                  </p>
                </div>
              </div>
              <dl className={styles.facts}>
                <div>
                  <dt>Situação</dt>
                  <dd>
                    <Badge status={sub.status}>
                      {
                        {
                          draft: "Aguardando publicação",
                          active: "Ativa",
                          paused: "Pausada",
                          cancelled: "Cancelada",
                        }[sub.status]
                      }
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt>Próximo vencimento</dt>
                  <dd>{dateLabel(sub.nextDueDate)}</dd>
                </div>
                <div>
                  <dt>Emissão e avisos</dt>
                  <dd>{dateLabel(issueDate(sub.nextDueDate, sub.leadDays))}</dd>
                </div>
                <div>
                  <dt>Valor por período</dt>
                  <dd>{currency(sub.amountCents)}</dd>
                </div>
              </dl>
              <p className={styles.helpText}>
                {sub.description}. Emissão e envio por e-mail e WhatsApp 5 dias
                antes de cada vencimento.
              </p>
              {sub.status !== "cancelled" && (
                <FormModal
                  trigger="Editar próximas cobranças"
                  title="Editar próximas cobranças"
                  description="As alterações valem para os próximos períodos. Faturas já emitidas permanecem preservadas."
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
                  <p className={styles.helpText}>
                    A alteração vale para os próximos períodos. Faturas já
                    emitidas permanecem preservadas.
                  </p>
                </FormModal>
              )}
              {sub.lastError && <p role="alert">{sub.lastError}</p>}
              {["active", "paused"].includes(sub.status) && (
                <ActionForm
                  action={changeSubscription}
                  confirm={{
                    title:
                      sub.status === "active"
                        ? "Pausar recorrência?"
                        : "Retomar recorrência?",
                    description:
                      sub.status === "active"
                        ? "As próximas emissões automáticas serão pausadas. Faturas já emitidas permanecem inalteradas."
                        : `As próximas emissões e avisos serão retomados. Próximo vencimento: ${dateLabel(sub.nextDueDate)}, no valor de ${currency(sub.amountCents)}.`,
                  }}
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
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.icon}>
                <FileText size={18} aria-hidden="true" />
              </span>
              <div>
                <h2>Nota fiscal</h2>
                <p>Documentação desta cobrança.</p>
              </div>
            </div>
            <p className={styles.helpText}>
              {i.fiscalStatus === "not_requested"
                ? "Emissão ainda não solicitada."
                : "Acompanhe a emissão com a equipe da Anuntech."}
            </p>
            {actor.admin && (
              <p className={styles.helpText}>
                {row.company.autoIssueNfse
                  ? "Este cliente está selecionado para nota fiscal automática. A emissão ainda depende da conclusão da integração fiscal."
                  : "Nota fiscal automática desativada para este cliente."}{" "}
                <Link href={`/empresas/${i.companyId}#cadastro`}>
                  Configurar no cadastro do cliente
                </Link>
                .
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
