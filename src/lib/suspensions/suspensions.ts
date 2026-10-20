import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { auditEvents, companies, engagementSuspensions, engagements, invoices } from "@/db/schema";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { currency, dateLabel } from "../format";
import { expiredDebtCondition } from "../billing/billing-watch";
import { paymentUrl } from "../billing/payment-link";
import { automationOn } from "../automations/automations";
import { companyAdministrators, sendClientMail } from "../notifications/client-mail";
import { getNoticePreferences, noticeEmails } from "../notifications/notification-preferences";
import { automationActorId } from "../ops/automation-actor";
import { governingTerms, snapshotOf } from "../service-terms/terms";
import { visibleToClient } from "../service-terms/ticket-clock";
import type { SuspensionPolicy, SuspensionReason } from "./suspension-rules";

type Executor = Pick<typeof db, "select">;

const consoleUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://console.anuntech.com";

/**
 * What a company owes past the day to pay, the way Atrasos counts it, plus
 * charges Inter closed unpaid. A charge Inter shows as received outside the
 * boleto still counts until the team confirms it on the invoice.
 */
export async function companyDebt(companyId: string, today = saoPauloDate(), executor: Executor = db) {
  const rows = await executor
    .select({ id: invoices.id, description: invoices.description, amountCents: invoices.amountCents, dueDate: invoices.dueDate, publicId: invoices.publicId, publicEnabled: invoices.publicEnabled })
    .from(invoices)
    .where(
      and(
        eq(invoices.companyId, companyId),
        sql`((${invoices.status} = 'issued' and coalesce(${invoices.bankDueDate}, ${invoices.dueDate}) < ${today}) or (${expiredDebtCondition}))`,
      ),
    )
    .orderBy(asc(invoices.dueDate));
  return {
    invoices: rows.map((row) => ({ ...row, link: row.publicEnabled && row.publicId ? paymentUrl(row.publicId) : null })),
    totalCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
    oldestDueDate: rows[0]?.dueDate ?? null,
  };
}

/** The suspension clause the client can read for this product (its own conditions, else the company's). */
export async function suspensionPolicy(companyId: string, engagementId: string, now = new Date()): Promise<SuspensionPolicy> {
  const terms = snapshotOf(await governingTerms(companyId, engagementId));
  const policy = terms && visibleToClient(terms, now) ? terms.policy : null;
  return policy?.suspensionDays ? { days: policy.suspensionDays, notice: !!policy.suspensionNotice, clause: policy.clauses.suspension ?? null } : null;
}

/** Who hears about a suspension: the billing contacts (when e-mail is on) and the Administradores. */
async function recipients(companyId: string) {
  const preferences = await getNoticePreferences(companyId, "billing");
  const billing = preferences.emailEnabled ? noticeEmails(preferences) : [];
  const managers = (await companyAdministrators(companyId)).map((person) => person.email.trim().toLowerCase());
  return [...new Set([...billing, ...managers].filter(Boolean))];
}

export type SuspensionMail = "notice" | "suspended" | "lifted";

/**
 * The three e-mails to the client: the notice before, the suspension, and the
 * reactivation. Each goes once per suspension (fixed idempotency key). For
 * late payment it repeats only the sentence of the published conditions.
 * Returns how many addresses Resend accepted.
 */
export async function sendSuspensionMail(kind: SuspensionMail, suspensionId: string) {
  const [row] = await db
    .select({ s: engagementSuspensions, product: engagements.name, company: companies.name })
    .from(engagementSuspensions)
    .innerJoin(engagements, eq(engagements.id, engagementSuspensions.engagementId))
    .innerJoin(companies, eq(companies.id, engagementSuspensions.companyId))
    .where(eq(engagementSuspensions.id, suspensionId));
  if (!row) return 0;
  const { s, product, company } = row;
  const to = await recipients(s.companyId);
  if (!to.length) return 0;
  const overdue = s.reason === "overdue";
  const debt = overdue && kind !== "lifted" ? await companyDebt(s.companyId) : null;
  const policy = overdue ? await suspensionPolicy(s.companyId, s.engagementId) : null;
  const owed = debt?.invoices.length
    ? [
        debt.invoices.length === 1
          ? `Consta em aberto a fatura "${debt.invoices[0].description}", vencida em ${dateLabel(debt.invoices[0].dueDate)}, de ${currency(debt.totalCents)}.`
          : `Constam em aberto ${debt.invoices.length} faturas vencidas desde ${dateLabel(debt.oldestDueDate!)}, no total de ${currency(debt.totalCents)}.`,
        debt.invoices.some((i) => i.link)
          ? `Você pode pagar com boleto ou Pix por aqui:\n${debt.invoices
              .filter((i) => i.link)
              .map((i) => `${i.description}: ${i.link}`)
              .join("\n")}`
          : `Você pode pagar com boleto ou Pix pelo Console, em Financeiro: ${consoleUrl()}/financeiro`,
      ]
    : [];
  const clause = policy
    ? `Pelas condições do contrato${policy.clause ? ` (cláusula ${policy.clause})` : ""}, com mais de ${policy.days} dias de atraso o serviço pode ser suspenso ${policy.notice ? "depois de um aviso" : "até o pagamento"}.`
    : null;
  const why: Record<SuspensionReason, string> = {
    overdue: "por atraso no pagamento",
    terms: "por descumprimento das condições de uso",
    other: "pelo motivo que a equipe combinou com vocês",
  };
  const mail = {
    notice: {
      subject: `Aviso de suspensão: ${product}`,
      lines: [
        "Olá,",
        `Este é um aviso sobre ${product}, da ${company}.`,
        ...owed,
        clause,
        `Se a situação não for regularizada, ${product} será suspenso ${why[s.reason]} em ${dateLabel(s.scheduledFor!)}.`,
        "Se já pagou ou precisa combinar uma data, responda este e-mail ou abra um chamado no Console. Os chamados continuam funcionando.",
      ],
    },
    suspended: {
      subject: `Serviço suspenso: ${product}`,
      lines: [
        "Olá,",
        `${product}, da ${company}, foi suspenso ${why[s.reason]}. Nenhum dado foi apagado.`,
        ...owed,
        overdue ? "Assim que o pagamento for confirmado, a equipe reativa o serviço." : "Para reativar, fale com a equipe.",
        `O Console continua disponível para pagar e abrir chamados: ${consoleUrl()}`,
      ],
    },
    lifted: {
      subject: `Serviço reativado: ${product}`,
      lines: ["Olá,", `${product}, da ${company}, foi reativado. Obrigado por regularizar.`, "Se algo não voltar como antes, abra um chamado no Console."],
    },
  }[kind];
  const text = [...mail.lines.filter(Boolean), "Equipe Anuntech"].join("\n\n");
  let sent = 0;
  for (const email of to) {
    try {
      await sendClientMail({ to: email, subject: mail.subject, text, tag: `suspension-${kind}`, key: suspensionId });
      sent += 1;
    } catch {
      /* The team sees the notice was not delivered and sends it another way. */
    }
  }
  return sent;
}

/**
 * After a payment (every billing-sync run): late-payment suspensions whose
 * company owes nothing past due anymore. A schedule not yet carried out is
 * cancelled; a suspended product is marked paid for the team to bring it
 * back, since it was blocked at the product by hand. (An integrated app will
 * come back on its own once it reads the state from the Console.)
 */
export async function settleSuspensions(today = saoPauloDate()) {
  const result = { cancelled: 0, settled: 0 };
  if (!(await automationOn("suspensionSettle"))) return result;
  const open = await db
    .select()
    .from(engagementSuspensions)
    .where(and(isNull(engagementSuspensions.liftedAt), isNull(engagementSuspensions.settledAt), eq(engagementSuspensions.reason, "overdue")));
  if (!open.length) return result;
  const actorId = await automationActorId();
  if (!actorId) return result;
  const owing = new Map<string, boolean>();
  for (const s of open) {
    if (!owing.has(s.companyId)) owing.set(s.companyId, (await companyDebt(s.companyId, today)).invoices.length > 0);
    if (owing.get(s.companyId)) continue;
    const now = new Date();
    const done = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(engagementSuspensions)
        .set(!s.suspendedAt ? { liftedAt: now, liftReason: "cancelled", liftNote: "Pago antes da data." } : { settledAt: now })
        .where(and(eq(engagementSuspensions.id, s.id), isNull(engagementSuspensions.liftedAt), isNull(engagementSuspensions.settledAt)))
        .returning({ id: engagementSuspensions.id });
      if (!row) return false;
      await tx.insert(auditEvents).values({
        actorId,
        companyId: s.companyId,
        entityId: s.engagementId,
        action: !s.suspendedAt ? "suspension.cancelled" : "suspension.settled",
        details: { suspensionId: s.id, reason: "paid", automatic: true },
      });
      return true;
    });
    if (done) result[!s.suspendedAt ? "cancelled" : "settled"]++;
  }
  return result;
}

/** Open suspensions of these engagements, for the lists and the menus. */
export async function openSuspensions(engagementIds: string[]) {
  if (!engagementIds.length) return new Map<string, typeof engagementSuspensions.$inferSelect>();
  const rows = await db
    .select()
    .from(engagementSuspensions)
    .where(and(inArray(engagementSuspensions.engagementId, engagementIds), isNull(engagementSuspensions.liftedAt)));
  return new Map(rows.map((row) => [row.engagementId, row]));
}

/** For the digest and the team's overview: suspensions due today (or late) and paid ones to bring back. */
export async function suspensionFollowUp(today = saoPauloDate()) {
  const rows = await db
    .select({ s: engagementSuspensions, product: engagements.name, company: companies.name })
    .from(engagementSuspensions)
    .innerJoin(engagements, eq(engagements.id, engagementSuspensions.engagementId))
    .innerJoin(companies, eq(companies.id, engagementSuspensions.companyId))
    .where(
      and(
        isNull(engagementSuspensions.liftedAt),
        sql`((${engagementSuspensions.suspendedAt} is null and ${engagementSuspensions.scheduledFor} <= ${today}) or ${isNotNull(engagementSuspensions.settledAt)})`,
      ),
    )
    .orderBy(asc(companies.name), asc(engagements.name));
  const due = rows.filter((r) => !r.s.suspendedAt);
  const paid = rows.filter((r) => r.s.suspendedAt && r.s.settledAt);
  return [
    {
      key: "suspensions-due",
      title: "Suspensões agendadas para hoje: confirme na lista de produtos",
      items: due.map((r) => ({ line: `${r.company} · ${r.product} · agendada para ${dateLabel(r.s.scheduledFor!)}`, href: `/produtos?company=${r.s.companyId}&status=all` })),
    },
    {
      key: "suspensions-paid",
      title: "Clientes que pagaram com produto suspenso: reative",
      items: paid.map((r) => ({ line: `${r.company} · ${r.product}`, href: `/produtos?company=${r.s.companyId}&status=all` })),
    },
  ].filter((group) => group.items.length);
}
