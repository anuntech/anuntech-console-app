import assert from "node:assert/strict";
import test from "node:test";
import { opsDigestText } from "../src/lib/ops-digest-text";

const base = {
  today: "2026-09-24",
  issued24h: 9,
  paid24h: 2,
  paused: [],
  noticeProblems: [],
  overdue: [],
  contracts: [],
  url: "https://console.anuntech.com",
};

test("a quiet day says so in the subject and the body", () => {
  const { subject, text } = opsDigestText(base);
  assert.equal(subject, "[Console] 24/09/2026: tudo em dia");
  assert.match(text, /Emitidas nas últimas 24 h: 9 · Recebidas: 2/);
  assert.match(text, /Tudo em dia/);
  assert.match(text, /console\.anuntech\.com\/financeiro/);
});

test("problems are counted in the subject and listed by section", () => {
  const { subject, text } = opsDigestText({
    ...base,
    paused: [{ company: "Espaço Absolut", description: "Synova", nextDueDate: "2026-09-29", error: "Complete o endereço." }],
    noticeProblems: [
      { company: "BLU", description: "Parcela 6", channel: "email", kind: "initial", status: "failed", error: "550" },
    ],
    overdue: [{ company: "Casa do Construtor", description: "Synova", amountCents: 163964, days: 46 }],
    contracts: [{ company: "Maxipark", title: "Prestação de serviços", label: "Vence em 12 dias" }],
  });
  assert.equal(subject, "[Console] 24/09/2026: 4 pontos para olhar");
  assert.match(text, /Recorrências pausadas \(1\):\n- Espaço Absolut · Synova · próximo 29\/09\/2026 · Complete o endereço\./);
  assert.match(text, /Avisos com problema nas últimas 24 h \(1\):\n- BLU · Parcela 6 · E-mail · Nova cobrança · Falhou · 550/);
  assert.match(text, /Faturas vencidas \(1\):\n- Casa do Construtor · Synova · R\$ 1\.639,64 · 46 dias de atraso/);
  assert.match(text, /Contratos vencendo ou vencidos \(1\):\n- Maxipark · Prestação de serviços · Vence em 12 dias/);
  assert.doesNotMatch(text, /Tudo em dia/);
});
