import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function runBillingTests({
  database: db,
  ids,
  people,
  request,
  submitForm,
  flags,
  sentNotices,
  ok,
  marker,
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const offset = (days) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const invoice = (id) =>
    one("select * from console_invoices where id=$1", [id]);
  const notices = (id) =>
    db
      .query(
        "select * from console_billing_notices where invoice_id=$1 order by created_at",
        [id],
      )
      .then((r) => r.rows);
  const cron = () =>
    request("/api/cron/recurring-billing", undefined, {
      headers: { Authorization: "Bearer test-cron-secret" },
    });
  async function drain() {
    for (let n = 0; n < 30; n++) {
      if (
        !(
          await one(
            "select count(*)::int n from console_billing_notices where locked_until>now()",
          )
        ).n
      )
        break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await db.query(
      "update console_billing_notices set next_attempt_at=now() where status in ('waiting','pending')",
    );
    const r = await cron();
    assert.equal(r.status, 200, r.text);
    // PostgreSQL's default now() has microseconds; the worker's JS clock has
    // milliseconds. A newly queued notice can miss that same fast CI tick.
    // Drain untouched, eligible notices before moving to another fixture date.
    if (
      (
        await one(
          "select count(*)::int n from console_billing_notices where status='waiting' and attempts=0 and locked_until is null and next_attempt_at<=now()",
        )
      ).n
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const retried = await cron();
      assert.equal(retried.status, 200, retried.text);
    }
  }
  flags({ approved: false, bankUnpaid: true, billingBankDue: offset(6) });
  await db.query(
    "update console_companies set phone='11999990002' where id=$1",
    [ids.a],
  );
  await submitForm("/financeiro/nova", "admin", "manager", "Criar rascunho", {
    companyId: ids.a,
    engagementId: "",
    description: `Recurring forbidden ${marker}`,
    amount: "499,00",
    dueDate: offset(15),
    billingType: "recurring",
    interval: "monthly",
  });
  ok(
    !(await one("select count(*)::int n from console_subscriptions")).n,
    "Cliente não cria recorrência por ação administrativa forjada",
  );
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", {
    companyId: ids.a,
    engagementId: "",
    description: `Recurring QA ${marker}`,
    amount: "499,00",
    dueDate: offset(15),
    billingType: "recurring",
    interval: "monthly",
  });
  const recurring = await one(
    "select * from console_invoices where description=$1",
    [`Recurring QA ${marker}`],
  );
  ok(
    recurring?.subscription_id && recurring.status === "draft",
    "Criação recorrente permanece rascunho até publicação",
  );
  const page = `/financeiro/${recurring.id}`;
  await submitForm(page, "admin", "admin", "Publicar cobrança recorrente", {
    id: recurring.id,
    confirm: "yes",
    numDiasAgenda: "45",
    activateRecurring: "yes",
  });
  let sub = await one("select * from console_subscriptions where id=$1", [
    recurring.subscription_id,
  ]);
  ok(
    sub.status === "active" &&
      !(await invoice(recurring.id)).bank_request &&
      !(await notices(recurring.id)).length,
    "Publicação antecipada agenda recorrência sem emitir ou enviar antes dos 5 dias",
  );
  const scheduledList = await request(
    "/financeiro?status=scheduled&q=" +
      encodeURIComponent(recurring.description),
    "admin",
  );
  ok(
    scheduledList.status === 200 &&
      scheduledList.text.includes(`/financeiro/${recurring.id}`) &&
      scheduledList.text.includes("Agendada"),
    "Filtro paginado mostra recorrência ativa como agendada",
  );
  const draftList = await request(
    "/financeiro?status=draft&q=" + encodeURIComponent(recurring.description),
    "admin",
  );
  ok(
    draftList.status === 200 &&
      !draftList.text.includes(`/financeiro/${recurring.id}`),
    "Recorrência agendada deixa a lista de rascunhos",
  );
  ok(
    (await request("/api/cron/recurring-billing")).status === 401,
    "Cron recorrente exige autenticação",
  );
  await submitForm(
    page,
    "admin",
    "admin",
    { action: "updateSubscription" },
    {
      id: sub.id,
      description: recurring.description,
      amount: "499,00",
      dueDate: offset(5),
    },
  );
  await cron();
  await drain();
  let i = await invoice(recurring.id);
  ok(
    i.bank_request.numDiasAgenda === 45,
    "Prazo de cancelamento escolhido na publicação acompanha a emissão automática",
  );
  ok(
    i.status === "issued" &&
      i.provider_id &&
      /^[A-Za-z0-9_-]{43}$/.test(i.public_id),
    "Cron emite no quinto dia anterior e cria identificador público não previsível",
  );
  sub = await one("select * from console_subscriptions where id=$1", [sub.id]);
  ok(
    (
      await one("select due_date::text due from console_invoices where id=$1", [
        i.id,
      ])
    ).due === offset(6) &&
      i.bank_request.dataVencimento === offset(5) &&
      sub.anchor_day === Number(offset(5).slice(8)),
    "Data efetiva do Inter libera boleto e Pix sem alterar a data solicitada ou âncora da recorrência",
  );
  const recurringNextDue = String(sub.next_due_date);
  ok(
    sub.next_due_date > i.due_date && sub.status === "active",
    "Emissão avança somente o próximo período da recorrência",
  );
  await cron();
  ok(
    String(
      (
        await one(
          "select next_due_date from console_subscriptions where id=$1",
          [sub.id],
        )
      ).next_due_date,
    ) === recurringNextDue,
    "Reconciliar vencimento ajustado novamente não avança nem desloca a recorrência",
  );
  ok(
    (
      await one(
        "select count(*)::int n from console_invoices where subscription_id=$1",
        [sub.id],
      )
    ).n === 1,
    "Cron repetido não duplica a fatura do período",
  );
  let rows = await notices(i.id);
  ok(
    rows.find((n) => n.channel === "email")?.status === "accepted" &&
      rows.find((n) => n.channel === "whatsapp")?.status === "pending",
    "E-mail é independente do modelo WhatsApp em revisão",
  );
  let publicPage = await request(`/pagar/${i.public_id}`);
  ok(
    publicPage.status === 200 &&
      publicPage.text.includes("QR Code Pix desta fatura") &&
      publicPage.text.includes("test-pix-payload") &&
      publicPage.text.includes("Baixar boleto PDF"),
    "Página pública abre sem login com QR Code, Pix e boleto",
  );
  const company = await one("select * from console_companies where id=$1", [
    ids.a,
  ]);
  ok(
    !publicPage.text.includes(company.document) &&
      !publicPage.text.includes(company.billing_email) &&
      !publicPage.text.includes('name="password"'),
    "Página pública limita os dados apresentados e não pede senha",
  );
  ok(
    (await request(`/pagar/${i.id}`)).status === 404,
    "ID interno da fatura não concede acesso público",
  );
  ok(
    (await request("/pagar/" + "z".repeat(43))).status === 404,
    "Identificador desconhecido não revela fatura",
  );
  let pdf = await request(`/pagar/${i.public_id}/boleto`);
  ok(
    pdf.status === 200 &&
      pdf.text.startsWith("%PDF-") &&
      pdf.headers.get("cache-control") === "private, no-store",
    "Boleto público validado é entregue sem cache",
  );
  await submitForm(
    page,
    "admin",
    "manager",
    { action: "changePaymentLink" },
    {
      id: i.id,
      enabled: "no",
    },
  );
  ok(
    (await invoice(i.id)).public_enabled,
    "Cliente não revoga link público por ação forjada",
  );
  await submitForm(
    page,
    "admin",
    "admin",
    { action: "changePaymentLink" },
    {
      id: i.id,
      enabled: "no",
    },
  );
  ok(
    (await request(`/pagar/${i.public_id}`)).status === 404 &&
      (await request(`/pagar/${i.public_id}/boleto`)).status === 404,
    "Revogar link bloqueia a página e o PDF imediatamente",
  );
  await submitForm(
    page,
    "admin",
    "admin",
    { action: "changePaymentLink" },
    {
      id: i.id,
      enabled: "yes",
    },
  );
  flags({ approved: true, bankUnpaid: true, billingBankDue: offset(6) });
  await drain();
  rows = await notices(i.id);
  ok(
    rows.every((n) => n.status === "accepted"),
    "WhatsApp é liberado após aprovação do modelo",
  );
  const wa = sentNotices().find(
    (n) => n.key === rows.find((n) => n.channel === "whatsapp").id,
  );
  const email = sentNotices().find((n) =>
    n.key.startsWith(`invoice-${rows.find((n) => n.channel === "email").id}-`),
  );
  ok(
    wa.payload.parameters["[id_fatura]"] === i.public_id &&
      wa.payload.parameters["[produto_ou_serviço]"] === i.description &&
      wa.payload.from === "551151073435" &&
      wa.payload.to === "5511999990002",
    "WhatsApp usa remetente solicitado, cadastro atual e ID público no botão",
  );
  ok(
    email.payload.html.includes(`/pagar/${i.public_id}`) &&
      !email.payload.html.includes("/financeiro/"),
    "Botão do e-mail aponta para pagamento público",
  );
  const sentCount = sentNotices().length;
  await drain();
  ok(
    sentNotices().length === sentCount,
    "Reexecução dos envios não duplica mensagens aceitas",
  );
  // A resend is processed right after the click, in the background: wait for it to settle before reading.
  const settledResends = async (count) => {
    for (let tries = 0; tries < 40; tries++) {
      await drain();
      const list = (await notices(i.id)).filter((n) => n.kind === "resend");
      if (list.length === count && list.every((n) => !["waiting", "pending", "sending"].includes(n.status))) return list;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return (await notices(i.id)).filter((n) => n.kind === "resend");
  };
  // "Reenviar" on one delivered notice: that channel, that contact, now; the other channel stays as it was.
  const beforeResend = sentNotices().length;
  const deliveredEmail = rows.find((n) => n.channel === "email");
  await submitForm(page, "admin", "finance", { action: "resendNoticeAgain" }, { noticeId: deliveredEmail.id });
  ok(!(await notices(i.id)).some((n) => n.kind === "resend"), "Cliente não reenvia o aviso");
  await submitForm(page, "admin", "admin", { action: "resendNoticeAgain" }, { noticeId: deliveredEmail.id });
  const resent = await settledResends(1);
  const resentEmail = sentNotices().find((n) => n.key.startsWith(`invoice-${resent[0]?.id}-`));
  ok(
    resent.length === 1 &&
      resent[0].channel === "email" &&
      resent[0].recipient === deliveredEmail.recipient &&
      resent[0].status === "accepted" &&
      sentNotices().length === beforeResend + 1 &&
      resentEmail?.payload.html.includes(`/pagar/${i.public_id}`),
    "Reenviar um aviso entregue manda de novo só por aquele canal, para o mesmo contato",
  );
  await submitForm(page, "admin", "admin", { action: "resendNoticeAgain" }, { noticeId: resent[0].id });
  ok(
    (await notices(i.id)).filter((n) => n.kind === "resend").every((n) => n.id === resent[0].id),
    "Reenvio logo depois do anterior é recusado",
  );
  await db.query("update console_billing_notices set created_at = now() - interval '10 minutes' where id=$1", [resent[0].id]);
  const whatsappRow = rows.find((n) => n.channel === "whatsapp");
  await submitForm(page, "admin", "admin", { action: "resendNoticeAgain" }, { noticeId: resent[0].id });
  await submitForm(page, "admin", "admin", { action: "resendNoticeAgain" }, { noticeId: whatsappRow.id });
  const again = await settledResends(2);
  ok(
    again.length === 2 &&
      again.every((n) => n.id !== resent[0].id && n.status === "accepted") &&
      sentNotices().length === beforeResend + 3 &&
      (await db.query("select count(*)::int as n from console_audit_events where entity_id=$1 and action='invoice.resent'", [i.id])).rows[0].n === 3,
    "Minutos depois o reenvio sai como mensagem nova, e cada canal se reenvia sozinho",
  );
  await submitForm(
    page,
    "admin",
    "admin",
    { action: "changeSubscription" },
    {
      id: sub.id,
      status: "paused",
    },
  );
  ok(
    (
      await one("select status from console_subscriptions where id=$1", [
        sub.id,
      ])
    ).status === "paused",
    "Administrador pausa as próximas emissões",
  );
  await submitForm(
    page,
    "admin",
    "admin",
    { action: "updateSubscription" },
    {
      id: sub.id,
      description: "Synova",
      amount: "599,00",
      dueDate: offset(40),
    },
  );
  ok(
    (await invoice(i.id)).amount_cents === 49900 &&
      (
        await one(
          "select amount_cents from console_subscriptions where id=$1",
          [sub.id],
        )
      ).amount_cents === 59900,
    "Editar próximas cobranças preserva valor da fatura emitida",
  );
  // A bank adjustment discovered after queuing must delay the due reminder.
  await db.query("update console_invoices set due_date=$2 where id=$1", [
    i.id,
    today,
  ]);
  const beforeDateAdjustment = sentNotices().length;
  flags({ approved: true, bankUnpaid: true, billingBankDue: offset(1) });
  await drain();
  // Before 08:00 in São Paulo the notice still waits for the sending hour ("waiting"); after it, for the bank's date ("pending"). Either way nothing goes out.
  ok(
    sentNotices().length === beforeDateAdjustment &&
      (await notices(i.id))
        .filter((n) => n.kind === "due")
        .every((n) => n.status === "pending" || n.status === "waiting"),
    "Aviso vence hoje aguarda a data efetiva quando o Inter prorroga o vencimento",
  );
  // Historical dates are test fixtures only; the bank mock independently returns the matching due date.
  for (const days of [0, 5, 10, 15, 20, 25]) {
    const due = offset(-days);
    await db.query("update console_invoices set due_date=$2 where id=$1", [
      i.id,
      due,
    ]);
    if (days === 5) {
      const before = sentNotices().length;
      flags({
        approved: true,
        bankUnpaid: true,
        billingBankDue: due,
        bankUnavailable: true,
      });
      await drain();
      ok(
        sentNotices().length === before,
        "Indisponibilidade do Inter bloqueia lembrete até confirmar que está pendente",
      );
    }
    if (days === 10) {
      flags({
        approved: true,
        bankUnpaid: true,
        billingBankDue: due,
        email503: true,
        whatsappTimeout: true,
      });
      await drain();
      const failed = (await notices(i.id)).filter(
        (n) => n.kind === "overdue_10",
      );
      ok(
        failed.find((n) => n.channel === "email")?.status === "pending" &&
          failed.find((n) => n.channel === "whatsapp")?.status === "uncertain",
        "E-mail temporariamente indisponível pode repetir; WhatsApp incerto exige conferência",
      );
    }
    flags({ approved: true, bankUnpaid: true, billingBankDue: due });
    await drain();
    const kind = days === 0 ? "due" : `overdue_${days}`;
    const events = (await notices(i.id)).filter((n) => n.kind === kind);
    ok(
      events.length === 2 &&
        events.every(
          (n) =>
            n.status ===
            (days === 10 && n.channel === "whatsapp"
              ? "uncertain"
              : "accepted"),
        ),
      `Aviso ${kind} enviado uma vez por canal após consulta ao Inter (${events.map((n) => `${n.channel}: ${n.status}, tentativas=${n.attempts}, erro=${n.error}`).join("; ")})`,
    );
    if (days === 10) {
      const emailEvent = events.find((n) => n.channel === "email");
      const whatsappEvent = events.find((n) => n.channel === "whatsapp");
      const emailAttempts = sentNotices().filter((n) =>
        n.key.startsWith(`invoice-${emailEvent.id}-`),
      );
      assert.equal(emailAttempts.length, 2);
      assert.equal(emailAttempts[0].key, emailAttempts[1].key);
      assert.deepEqual(emailAttempts[0].payload, emailAttempts[1].payload);
      ok(true, "Repetição de e-mail conserva a chave idempotente e o conteúdo");
      ok(
        sentNotices().filter((n) => n.key === whatsappEvent.id).length === 1,
        "Timeout no WhatsApp de cobrança nunca repete o POST automaticamente",
      );
    }
    if (days > 0) {
      const payload = events.find((n) => n.channel === "whatsapp").payload;
      ok(
        payload.parameters["[dias_em_atraso]"] === String(days),
        `Modelo de atraso informa ${days} dias e mantém ID da fatura`,
      );
    }
    await drain();
    ok(
      (await notices(i.id)).filter((n) => n.kind === kind).length === 2,
      `Cron não duplica estágio ${kind}`,
    );
  }
  let n = sentNotices().length;
  await db.query("update console_invoices set due_date=$2 where id=$1", [
    i.id,
    offset(-30),
  ]);
  flags({ approved: true, bankUnpaid: true, billingBankDue: offset(-30) });
  await drain();
  ok(
    // The automatic ones only: the team's resends above are not reminders.
    sentNotices().length === n && (await notices(i.id)).filter((x) => x.kind !== "resend").length === 14,
    "Cobrança tem exatamente 5 avisos de atraso por canal e encerra aos 30 dias",
  );
  // Payment arriving before a queued notice must suppress it.
  await db.query("update console_invoices set due_date=$2 where id=$1", [
    i.id,
    offset(2),
  ]);
  await db.query(
    "update console_billing_notices set kind='initial', status='pending', next_attempt_at=now() where invoice_id=$1 and kind='initial'",
    [i.id],
  );
  flags({ approved: true, billingBankDue: offset(2) });
  await drain();
  ok(
    (await invoice(i.id)).status === "paid" && sentNotices().length === n,
    "Consulta imediatamente anterior ao envio interrompe avisos de fatura paga",
  );
  publicPage = await request(`/pagar/${i.public_id}`);
  ok(
    publicPage.text.includes("Pagamento confirmado") &&
      !publicPage.text.includes("test-pix-payload") &&
      (await request(`/pagar/${i.public_id}/boleto`)).status === 404,
    "Fatura paga não oferece Pix ou boleto para novo pagamento",
  );
  // An interrupted WhatsApp worker never blindly repeats the POST.
  const interrupted = randomUUID();
  await db.query(
    "insert into console_billing_notices(id,invoice_id,actor_id,channel,kind,status,attempts,locked_until) values($1,$2,$3,'whatsapp','test_interrupted','sending',1,now()-interval '1 minute')",
    [interrupted, i.id, people.admin.id],
  );
  await drain();
  ok(
    (
      await one("select status from console_billing_notices where id=$1", [
        interrupted,
      ])
    ).status === "uncertain" && sentNotices().length === n,
    "Worker interrompido marca WhatsApp como incerto sem repetir POST",
  );
  await db.query(
    "update console_billing_notices set next_attempt_at=now() where status='accepted'",
  );
  await drain();
  ok(
    (await notices(i.id)).some(
      (n) => n.channel === "email" && n.status === "delivered",
    ) &&
      (await notices(i.id)).some(
        (n) => n.channel === "whatsapp" && n.status === "delivered",
      ),
    "Entrega efetiva de e-mail e WhatsApp é confirmada por consulta ao provedor",
  );
  flags({ approved: true, emailBounced: true });
  await db.query(
    "update console_billing_notices set next_attempt_at=now() where channel='email' and status='delivered'",
  );
  await drain();
  ok(
    (await notices(i.id)).some(
      (n) =>
        n.channel === "email" &&
        n.provider_status === "bounced" &&
        n.status === "failed" &&
        n.error.includes("não permite remetentes externos"),
    ),
    "Devolução posterior do e-mail mostra falha e motivo do bloqueio externo",
  );
  ok(
    (await request("/financeiro/envios", "admin")).status === 200 &&
      (await request("/financeiro/envios", "manager")).text.includes(
        "NEXT_HTTP_ERROR_FALLBACK;404",
      ),
    "Histórico de entrega é restrito ao administrador",
  );
  // Notification preferences affect real workers, without changing bank/payment rules.
  flags({ approved: true, bankUnpaid: true, billingBankDue: offset(2) });
  await db.query(
    "update console_invoices set status='issued', due_date=$2 where id=$1",
    [i.id, offset(2)],
  );
  const resetInitial = async () =>
    db.query(
      "update console_billing_notices set recipient='', status='pending', payload=null, attempts=0, first_attempt_at=null, provider_id=null, provider_status=null, locked_until=null, next_attempt_at=now() where invoice_id=$1 and kind='initial'",
      [i.id],
    );
  const preferenceId = `${ids.a}:billing`;
  await db.query(
    "insert into console_notification_preferences(key,company_id,topic,email,phone,email_enabled,whatsapp_enabled) values($1,$2,'billing',$3,'11988887777',false,false)",
    [preferenceId, ids.a, `billing-preference-${marker}@example.invalid`],
  );
  await resetInitial();
  let beforePreferences = sentNotices().length;
  await drain();
  ok(
    sentNotices().length === beforePreferences &&
      (await notices(i.id))
        .filter((row) => row.kind === "initial")
        .every((row) => row.status === "skipped"),
    "Desativar canais financeiros interrompe a fila sem enviar mensagens",
  );
  await db.query(
    "update console_notification_preferences set email_enabled=true where key=$1",
    [preferenceId],
  );
  await resetInitial();
  await drain();
  const preferenceNotice = (await notices(i.id)).find(
    (row) => row.kind === "initial" && row.channel === "email",
  );
  ok(
    preferenceNotice.payload.to[0] ===
      `billing-preference-${marker}@example.invalid` &&
      sentNotices()
        .slice(beforePreferences)
        .every((row) => row.channel === "email"),
    "Cobrança usa contato específico do financeiro e respeita WhatsApp desativado",
  );
  flags({
    approved: true,
    bankUnpaid: true,
    billingBankDue: offset(2),
    email503: true,
  });
  await resetInitial();
  await drain();
  const frozenNotice = (await notices(i.id)).find(
    (row) => row.kind === "initial" && row.channel === "email",
  );
  ok(
    frozenNotice.attempts > 0 && !!frozenNotice.payload,
    "Falha transitória preserva payload do destinatário original",
  );
  await db.query(
    "update console_notification_preferences set email=$2 where key=$1",
    [preferenceId, `changed-preference-${marker}@example.invalid`],
  );
  beforePreferences = sentNotices().length;
  await drain();
  ok(
    sentNotices().length === beforePreferences &&
      (await notices(i.id)).find((row) => row.id === frozenNotice.id).status ===
        "skipped",
    "Troca de destinatário cancela repetição congelada sem reenviar ao endereço antigo ou duplicar no novo",
  );
  flags({ approved: true, bankUnpaid: true, billingBankDue: offset(2) });
  const extraEmails = [
      `multi-one-${marker}@example.invalid`,
      `multi-two-${marker}@example.invalid`,
    ],
    extraPhones = ["11966665555", "11955554444"];
  await db.query(
    "update console_notification_preferences set emails=$2::jsonb,phones=$3::jsonb,email_enabled=true,whatsapp_enabled=true where key=$1",
    [preferenceId, JSON.stringify(extraEmails), JSON.stringify(extraPhones)],
  );
  await db.query(
    "delete from console_billing_notices where invoice_id=$1 and kind='initial'",
    [i.id],
  );
  for (const channel of ["email", "whatsapp"])
    await submitForm(
      `/financeiro/${i.id}`,
      "admin",
      "admin",
      { action: "sendInvoiceNotice" },
      { id: i.id, channel },
    );
  await drain();
  const multiple = (await notices(i.id)).filter(
    (row) =>
      extraEmails.includes(row.recipient) ||
      extraPhones.map((phone) => `55${phone}`).includes(row.recipient),
  );
  ok(
    multiple.length === 4 &&
      multiple.every((row) => ["accepted", "delivered"].includes(row.status)),
    "Financeiro envia uma mensagem separada para cada um dos dois e-mails e dois telefones",
  );
  ok(
    multiple
      .filter((row) => row.channel === "email")
      .every((row) => row.payload.to.length === 1),
    "E-mails de outros destinatários não são expostos na mensagem",
  );
  await db.query("delete from console_notification_preferences where key=$1", [
    preferenceId,
  ]);
  await db.query("update console_invoices set status='paid' where id=$1", [
    i.id,
  ]);
  flags({ approved: true });

  // Monthly recurrence: once the period is paid at Inter, the next one is issued
  // right away, and its client notice still waits for the usual day.
  flags({ approved: true, bankUnpaid: true });
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", {
    companyId: ids.a,
    engagementId: "",
    description: `Early QA ${marker}`,
    amount: "321,00",
    dueDate: offset(15),
    billingType: "recurring",
    interval: "monthly",
  });
  const early = await one("select * from console_invoices where description=$1", [`Early QA ${marker}`]);
  const earlyPage = `/financeiro/${early.id}`;
  await submitForm(earlyPage, "admin", "admin", "Publicar cobrança recorrente", {
    id: early.id,
    confirm: "yes",
    numDiasAgenda: "30",
    activateRecurring: "yes",
  });
  await submitForm(earlyPage, "admin", "admin", { action: "updateSubscription" }, {
    id: early.subscription_id,
    description: early.description,
    amount: "321,00",
    dueDate: offset(4),
  });
  await cron();
  const periods = async () =>
    (await db.query("select id, status, due_date::text due from console_invoices where subscription_id=$1 order by due_date", [early.subscription_id])).rows;
  let earlySub = await one("select next_due_date::text next, issue_on_payment from console_subscriptions where id=$1", [early.subscription_id]);
  ok((await periods()).length === 1 && (await periods())[0].status === "issued" && earlySub.issue_on_payment === true, "Recorrência mensal nasce emitindo a próxima depois do pagamento");
  await cron();
  ok((await periods()).length === 1, "Sem pagamento, a próxima espera o dia de sempre");
  const upcomingPage = await request(`/financeiro?company=${ids.a}`, "manager");
  ok(upcomingPage.text.includes("Próximas cobranças") && upcomingPage.text.includes(`Early QA ${marker}`), "Cliente vê a próxima cobrança antes de ela ser emitida");
  // The team sees only the recurrences that need someone, never the list of the ones that go out on their own.
  ok(!(await request(`/financeiro?company=${ids.a}`, "admin")).text.includes("Próximas cobranças"), "A equipe não vê a lista das cobranças em dia, só as recorrências para corrigir");
  // Inter confirms the payment of the current period.
  flags({ approved: true, bankUnpaid: false });
  await submitForm(earlyPage, "admin", "admin", { action: "syncCharge" }, { id: early.id });
  await submitForm(earlyPage, "admin", "admin", { action: "syncCharge" }, { id: early.id });
  flags({ approved: true, bankUnpaid: true });
  ok((await invoice(early.id)).status === "paid", "O Inter confirma o pagamento da fatura atual");
  await cron();
  let rows2 = await periods();
  const next = rows2.find((row) => row.due === earlySub.next);
  ok(rows2.length === 2 && next?.status === "issued", "Paga a atual, a próxima é emitida no Inter em seguida");
  const nextSub = await one("select next_due_date::text next from console_subscriptions where id=$1", [early.subscription_id]);
  ok(nextSub.next > earlySub.next, "A recorrência avança um período com a emissão antecipada");
  const held = await notices(next.id);
  const usualDay = new Date(`${next.due}T12:00:00Z`);
  usualDay.setUTCDate(usualDay.getUTCDate() - 5);
  ok(
    held.length > 0 && held.every((row) => row.kind === "initial" && ["waiting", "pending"].includes(row.status) && new Date(row.next_attempt_at).toISOString() === `${usualDay.toISOString().slice(0, 10)}T11:00:00.000Z`),
    "O aviso da fatura antecipada sai no dia de sempre, 5 dias antes do vencimento, às 8h",
  );
  await cron();
  ok((await periods()).length === 2, "Fatura antecipada em aberto não gera outra");
  // Moving the next due date into the month already at the bank would bill it twice.
  const before = (await one("select next_due_date::text next from console_subscriptions where id=$1", [early.subscription_id])).next;
  await submitForm(earlyPage, "admin", "admin", { action: "updateSubscription" }, {
    id: early.subscription_id,
    description: early.description,
    amount: "321,00",
    dueDate: `${next.due.slice(0, 8)}${next.due.slice(8) === "28" ? "27" : "28"}`,
  });
  ok((await one("select next_due_date::text next from console_subscriptions where id=$1", [early.subscription_id])).next === before, "Editar a recorrência não aceita vencimento num mês já emitido");
  // Cancelling at Inter: only the team, and the notices stop.
  await submitForm(`/financeiro/${next.id}`, "manager", "manager", { action: "cancelCharge" }, { id: next.id });
  ok((await invoice(next.id)).status === "issued", "Cliente não cancela cobrança no Inter");
  await submitForm(`/financeiro/${next.id}`, "admin", "admin", { action: "cancelCharge" }, { id: next.id, reason: "Cliente encerrou o serviço" });
  ok((await invoice(next.id)).status === "cancelled", "Equipe cancela no Inter e a fatura fica cancelada");
  ok((await one("select status from console_subscriptions where id=$1", [early.subscription_id])).status === "paused", "Cancelar no Inter pausa a recorrência, sem emitir o período seguinte");
  ok((await notices(next.id)).every((row) => row.status === "skipped"), "Cancelada no Inter, nenhum aviso sai");
  ok(
    !!(await one("select 1 as ok from console_audit_events where entity_id=$1 and action='invoice.bank_cancel_requested'", [next.id])),
    "O cancelamento no Inter fica no histórico",
  );

  // A charge Inter closed unpaid stays a debt: listed, billed again once, or written off with a reason.
  flags({ approved: true });
  const expiredId = randomUUID(), expiredTwo = randomUUID();
  for (const [eid, label] of [[expiredId, `Expired QA ${marker}`], [expiredTwo, `Expired close QA ${marker}`]])
    await db.query(
      "insert into console_invoices(id,company_id,description,amount_cents,due_date,status,bank_status,provider_id,bank_base) values($1,$2,$3,15000,$4,'cancelled','EXPIRADO',$5,'https://cdpj.partners.bancointer.com.br')",
      [eid, ids.a, label, offset(-40), randomUUID()],
    );
  let debtList = await request(`/financeiro?status=expired&q=${encodeURIComponent(`Expired QA ${marker}`)}`, "admin");
  ok(debtList.text.includes(`/financeiro/${expiredId}`) && debtList.text.includes("Expirada sem pagamento"), "Fatura que o Inter expirou aparece como dívida, não como cancelada");
  const debtPage = await request(`/financeiro/${expiredId}`, "admin");
  ok(debtPage.text.includes("Expirou no Inter sem pagamento") && debtPage.text.includes(`/financeiro/nova?de=${expiredId}`), "A fatura expirada oferece Cobrar de novo");
  const rebillForm = await request(`/financeiro/nova?de=${expiredId}`, "admin");
  ok(rebillForm.text.includes(`Expired QA ${marker}`) && rebillForm.text.includes('name="sourceKind"'), "Cobrar de novo abre a cobrança já preenchida");
  const rebill = {
    companyId: ids.a,
    engagementId: "",
    description: `Expired QA ${marker} de novo`,
    amount: "150,00",
    dueDate: offset(-40),
    bankDueDate: offset(7),
    billingType: "one_time",
    sourceKind: "rebill",
    sourceId: expiredId,
  };
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", rebill);
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", rebill);
  ok(
    (await db.query("select bank_due_date::text due from console_invoices where description=$1", [rebill.description])).rows.map((r) => r.due).join() === offset(7),
    "A dívida vira uma cobrança nova com nova data para pagar, uma vez só",
  );
  debtList = await request(`/financeiro?status=expired&q=${encodeURIComponent(`Expired QA ${marker}`)}`, "admin");
  ok(!debtList.text.includes(`/financeiro/${expiredId}`), "Cobrada de novo, sai da lista de expiradas");
  await submitForm(`/financeiro/${expiredTwo}`, "admin", "manager", { action: "closeDebt" }, { id: expiredTwo, reason: "Pago por transferência" });
  ok(!(await one("select 1 as ok from console_automation_events where entity_id=$1", [expiredTwo])), "Cliente não encerra dívida");
  await submitForm(`/financeiro/${expiredTwo}`, "admin", "admin", { action: "closeDebt" }, { id: expiredTwo, reason: "Pago por transferência" });
  ok(
    (await one("select details->>'reason' reason from console_automation_events where entity_id=$1 and kind='debt.closed'", [expiredTwo]))?.reason === "Pago por transferência",
    "Equipe encerra a dívida com o motivo registrado",
  );
  // Cancelling the new draft gives the debt back; an open debt cannot be deleted away.
  const rebillDraft = await one("select id from console_invoices where description=$1", [rebill.description]);
  await submitForm(`/financeiro/${rebillDraft.id}`, "admin", "admin", { action: "cancelDraft" }, { id: rebillDraft.id });
  debtList = await request(`/financeiro?status=expired&q=${encodeURIComponent(`Expired QA ${marker}`)}`, "admin");
  ok(debtList.text.includes(`/financeiro/${expiredId}`), "Cancelar o rascunho da nova cobrança devolve a dívida à lista");
  await submitForm(`/financeiro/${expiredId}`, "admin", "admin", { action: "deleteDraftInvoice" }, { id: expiredId });
  ok(!!(await one("select 1 as ok from console_invoices where id=$1", [expiredId])), "Dívida em aberto não pode ser excluída");
  // A reissue cancels an earlier charge of the same invoice; only a cancel of the charge that expired hides it.
  const reissued = randomUUID(), teamCancelled = randomUUID(), currentCharge = randomUUID();
  for (const [eid, label, provider] of [[reissued, `Expired reissued QA ${marker}`, currentCharge], [teamCancelled, `Expired cancelled QA ${marker}`, randomUUID()]])
    await db.query(
      "insert into console_invoices(id,company_id,description,amount_cents,due_date,status,bank_status,provider_id,bank_base) values($1,$2,$3,15000,$4,'cancelled','EXPIRADO',$5,'https://cdpj.partners.bancointer.com.br')",
      [eid, ids.a, label, offset(-40), provider],
    );
  await db.query("insert into console_audit_events(id,actor_id,company_id,entity_id,action,details) values($1,$2,$3,$4,'invoice.bank_cancelled',$5)", [
    randomUUID(), people.admin.id, ids.a, reissued, JSON.stringify({ providerId: randomUUID() }),
  ]);
  await db.query("insert into console_audit_events(id,actor_id,company_id,entity_id,action,details) values($1,$2,$3,$4,'invoice.bank_cancel_requested',$5)", [
    randomUUID(), people.admin.id, ids.a, teamCancelled, JSON.stringify({ providerId: (await one("select provider_id from console_invoices where id=$1", [teamCancelled])).provider_id }),
  ]);
  debtList = await request(`/financeiro?status=expired&q=${encodeURIComponent(`QA ${marker}`)}`, "admin");
  ok(
    debtList.text.includes(`/financeiro/${reissued}`) && !debtList.text.includes(`/financeiro/${teamCancelled}`),
    "Fatura reemitida que expirou continua dívida; a que a equipe cancelou, não",
  );
  // Finishing a project pauses its recurrence even when it was created in Nova cobrança (linked only by the recurrence).
  const leavingProject = randomUUID(), leavingPlan = randomUUID();
  await db.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,$3,'project')", [leavingProject, ids.a, `Leaving project ${marker}`]);
  await db.query(
    "insert into console_subscriptions(id,company_id,engagement_id,description,amount_cents,interval,anchor_day,anchor_month,next_due_date,status,actor_id) values ($1,$2,$3,$4,30000,'monthly',$5,$6,$7,'active',$8)",
    [leavingPlan, ids.a, leavingProject, `Leaving plan ${marker}`, Number(offset(30).slice(8)), Number(offset(30).slice(5, 7)), offset(30), people.admin.id],
  );
  await submitForm("/projetos", "admin", "admin", { action: "updateEngagement" }, { id: leavingProject, status: "completed", pauseBilling: "yes" });
  ok(
    (await one("select status from console_subscriptions where id=$1", [leavingPlan]))?.status === "paused",
    "Concluir o projeto pausa a recorrência criada no Financeiro",
  );
  await db.query("delete from console_audit_events where entity_id = any($1)", [[reissued, teamCancelled, leavingProject, leavingPlan]]);
  await db.query("delete from console_invoices where id = any($1)", [[reissued, teamCancelled]]);
  await db.query("delete from console_subscriptions where id=$1", [leavingPlan]);
  await db.query("delete from console_engagements where id=$1", [leavingProject]);

  // The morning digest warns before money is lost; each routine records its runs; the alerts' delivery is read back.
  const unready = randomUUID();
  await db.query("insert into console_companies(id,name,document,billing_email) values ($1,$2,'11444777000161',$3)", [unready, `Unready QA ${marker}`, `unready-${marker}@example.invalid`]);
  await db.query(
    "insert into console_subscriptions(id,company_id,description,amount_cents,interval,anchor_day,anchor_month,next_due_date,status,actor_id) values ($1,$2,$3,30000,'monthly',$4,$5,$6,'active',$7)",
    [randomUUID(), unready, `Unready plan ${marker}`, Number(offset(30).slice(8)), Number(offset(30).slice(5, 7)), offset(30), people.admin.id],
  );
  await db.query(
    "insert into console_invoices(id,company_id,description,amount_cents,due_date,status,bank_status,provider_id,bank_base) values($1,$2,$3,15000,$4,'cancelled','EXPIRADO',$5,'https://cdpj.partners.bancointer.com.br')",
    [randomUUID(), ids.a, `Expired open QA ${marker}`, offset(-40), randomUUID()],
  );
  const sentBefore = sentNotices().length;
  const digest = await request("/api/cron/ops-digest", undefined, { headers: { Authorization: "Bearer test-cron-secret" } });
  const digestMail = sentNotices().slice(sentBefore).find((n) => n.channel === "email" && String(n.payload.subject).startsWith("[Console]"));
  const digestText = String(digestMail?.payload.text ?? "");
  ok(
    digest.status === 200 &&
      digestText.includes("Emissões que vão falhar se ninguém mexer") &&
      digestText.includes(`Unready QA ${marker}`) &&
      digestText.includes("Expiradas no Inter sem pagamento") &&
      digestText.includes(`Expired open QA ${marker}`) &&
      !digestText.includes(`Expired close QA ${marker}`),
    "O resumo da manhã avisa a emissão que vai falhar e a dívida expirada",
  );
  ok(
    !!(await one("select last_ok_at from console_cron_runs where name='ops-digest'"))?.last_ok_at &&
      !!(await one("select last_ok_at from console_cron_runs where name='recurring-billing'"))?.last_ok_at,
    "Cada rotina registra a última execução",
  );
  ok(!!(await one("select 1 as ok from console_automation_events where kind='ops-mail' limit 1")), "Os alertas da equipe guardam o envio para conferir a entrega");
  await db.query("delete from console_subscriptions where company_id=$1", [unready]);
  await db.query("delete from console_companies where id=$1", [unready]);
  flags({ approved: true });
}
