import assert from "node:assert/strict";
import test from "node:test";
import { nextDueDate, issueDate } from "../src/lib/billing/recurrence";
import { billingEmailTemplate } from "../src/lib/billing/billing-email-template";
test("monthly recurrence clamps February and recovers the original day", () => {
  assert.equal(nextDueDate("2027-01-31", "monthly", 31, 1), "2027-02-28");
  assert.equal(nextDueDate("2027-02-28", "monthly", 31, 1), "2027-03-31");
  assert.equal(nextDueDate("2026-12-30", "monthly", 30, 12), "2027-01-30");
});
test("annual leap-day recurrence returns to leap day in leap years", () => {
  assert.equal(nextDueDate("2024-02-29", "yearly", 29, 2), "2025-02-28");
  assert.equal(nextDueDate("2027-02-28", "yearly", 29, 2), "2028-02-29");
});
test("issue date is five civil days before due date across year boundaries", () => {
  assert.equal(issueDate("2027-01-02"), "2026-12-28");
});
test("billing email escapes customer input and uses the public payment URL", () => {
  const email = billingEmailTemplate({
    name: '<script>alert("x")</script>',
    description: "A & B",
    amountCents: 10001,
    dueDate: "2026-11-25",
    url: "https://console.example/pagar/abc",
  });
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.html.includes("A &amp; B"));
  assert.ok(email.html.includes('href="https://console.example/pagar/abc"'));
  assert.ok(email.text.includes("25/11/2026"));
  assert.ok(!email.html.includes("/entrar"));
});

import {
  reminderKind,
  noticeIsCurrent,
  billingWhatsappParameters,
} from "../src/lib/billing/billing-notice-rules";
test("reminders send five stages, never an accumulated backlog", () => {
  const due = "2026-01-01";
  assert.equal(reminderKind(due, "2025-12-31"), null);
  assert.equal(reminderKind(due, due), "due");
  assert.equal(reminderKind(due, "2026-01-05"), null);
  for (const offset of [5, 10, 15, 20, 25]) {
    const day = `2026-01-${String(offset + 1).padStart(2, "0")}`;
    assert.equal(reminderKind(due, day), `overdue_${offset}`);
  }
  assert.equal(reminderKind(due, "2026-01-31"), null);
  assert.equal(noticeIsCurrent("due", due, "2026-01-02"), false);
  assert.equal(noticeIsCurrent("initial", due, due), false);
  assert.equal(noticeIsCurrent("overdue_5", due, "2026-01-11"), false);
  assert.equal(reminderKind(due, "2026-01-12"), "overdue_10");
});
test("WhatsApp button receives only public invoice ID and exact template fields", () => {
  const data = {
    name: "Cliente",
    description: "Synova",
    amountCents: 49900,
    dueDate: "2026-04-01",
    publicId: "x".repeat(43),
    today: "2026-04-09",
    kind: "overdue_5" as const,
  };
  const p = billingWhatsappParameters(data);
  assert.equal(p["[id_fatura]"], data.publicId);
  assert.equal(p["[dias_em_atraso]"], "8");
  assert.equal(p["[produto_ou_serviço]"], "Synova");
  assert.equal(p["[valor]"].replace(/\s/g, ""), "R$499,00");
  assert.equal(p["[vencimento]"], undefined);
  const email = billingEmailTemplate({
    ...data,
    url: "https://console.example/pagar/id",
  });
  assert.ok(email.text.includes("em aberto há 8 dias"));
  assert.ok(email.text.includes("Valor atualizado"));
});
