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
  }
  flags({ approved: false, bankUnpaid: true });
  await db.query(
    "update console_companies set phone='11999990002' where id=$1",
    [ids.a],
  );
  await submitForm("/financeiro/nova", "admin", "manager", "Salvar rascunho", {
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
  await submitForm("/financeiro/nova", "admin", "admin", "Salvar rascunho", {
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
  await submitForm(page, "admin", "admin", "Salvar recorrência", {
    id: sub.id,
    description: recurring.description,
    amount: "499,00",
    dueDate: offset(5),
  });
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
    sub.next_due_date > i.due_date && sub.status === "active",
    "Emissão avança somente o próximo período da recorrência",
  );
  await cron();
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
  await submitForm(page, "admin", "manager", "Desativar link público", {
    id: i.id,
    enabled: "no",
  });
  ok(
    (await invoice(i.id)).public_enabled,
    "Cliente não revoga link público por ação forjada",
  );
  await submitForm(page, "admin", "admin", "Desativar link público", {
    id: i.id,
    enabled: "no",
  });
  ok(
    (await request(`/pagar/${i.public_id}`)).status === 404 &&
      (await request(`/pagar/${i.public_id}/boleto`)).status === 404,
    "Revogar link bloqueia a página e o PDF imediatamente",
  );
  await submitForm(page, "admin", "admin", "Ativar link público", {
    id: i.id,
    enabled: "yes",
  });
  flags({ approved: true, bankUnpaid: true });
  await drain();
  rows = await notices(i.id);
  ok(
    rows.every((n) => n.status === "accepted"),
    "WhatsApp é liberado após aprovação do modelo",
  );
  const wa = sentNotices().find(
    (n) => n.key === rows.find((n) => n.channel === "whatsapp").id,
  );
  const email = sentNotices().find(
    (n) => n.key === `invoice-${rows.find((n) => n.channel === "email").id}`,
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
  await submitForm(page, "admin", "admin", "Pausar recorrência", {
    id: sub.id,
    status: "paused",
  });
  ok(
    (
      await one("select status from console_subscriptions where id=$1", [
        sub.id,
      ])
    ).status === "paused",
    "Administrador pausa as próximas emissões",
  );
  await submitForm(page, "admin", "admin", "Salvar recorrência", {
    id: sub.id,
    description: "Synova",
    amount: "599,00",
    dueDate: offset(40),
  });
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
      `Aviso ${kind} enviado uma vez por canal após consulta ao Inter`,
    );
    if (days === 10) {
      const emailEvent = events.find((n) => n.channel === "email");
      const whatsappEvent = events.find((n) => n.channel === "whatsapp");
      const emailAttempts = sentNotices().filter(
        (n) => n.key === `invoice-${emailEvent.id}`,
      );
      assert.equal(emailAttempts.length, 2);
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
    sentNotices().length === n && (await notices(i.id)).length === 14,
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
        "Página não encontrada",
      ),
    "Histórico de entrega é restrito ao administrador",
  );
  flags({ approved: true });
}
