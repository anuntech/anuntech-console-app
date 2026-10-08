import assert from "node:assert/strict";
import test from "node:test";
import { opsDigestText } from "../src/lib/notifications/ops-digest-text";

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

test("tickets close to their first-response deadline are in the summary", () => {
  const { text, subject } = opsDigestText({
    today: "2026-10-05",
    issued24h: 0,
    paid24h: 0,
    paused: [],
    noticeProblems: [],
    overdue: [],
    contracts: [],
    tickets: [{ id: "t1", company: "Cliente", subject: "Sistema fora do ar", dueAt: "2026-10-05T15:00:00.000Z" }],
    url: "https://console.example",
  });
  assert.match(text, /Chamados sem primeira resposta, com prazo até hoje \(1\)/);
  assert.match(text, /Cliente · Sistema fora do ar/);
  assert.match(text, /https:\/\/console\.example\/chamados\/t1/);
  assert.match(subject, /1 ponto/);
});

test("what would cost money is in the summary, each with its link", () => {
  const { text, subject } = opsDigestText({
    ...base,
    failing: [{ companyId: "c1", company: "KAPÔ", description: "Squad", issueDate: "2026-10-12", reason: "Cadastro: endereço de cobrança incompleto" }],
    expired: [{ id: "i1", company: "Casa", description: "Synova agosto", amountCents: 163964, dueDate: "2026-08-10" }],
    expiring: [{ id: "i2", company: "Absolut", description: "Synova", amountCents: 45900, expiresOn: "2026-10-12" }],
    leaving: [{ company: "Maxi", description: "Hospedagem", issueDate: "2026-10-20", reason: "serviço concluído" }],
    routines: [{ label: "Conciliação com o Inter", quiet: "sem rodar há 2 h", lastError: null }],
    unreachable: [{ email: "x@anuntech.com", event: "suppressed", since: "2026-09-24T01:47:00Z" }],
    certificate: { expiresOn: "2026-10-20", days: 12 },
  });
  assert.equal(subject, "[Console] 24/09/2026: 7 pontos para olhar");
  assert.match(text, /O certificado do Inter vence em 20\/10\/2026 \(12 dias\)/);
  assert.match(text, /Rotinas paradas \(1\):\n- Conciliação com o Inter · sem rodar há 2 h/);
  assert.match(text, /Emissões que vão falhar se ninguém mexer \(1\):\n- KAPÔ · Squad · emite até 12\/10\/2026 · Cadastro: endereço de cobrança incompleto · https:\/\/console\.anuntech\.com\/empresas\/c1\?editar=1/);
  assert.match(text, /Expiradas no Inter sem pagamento \(1\):\n- Casa · Synova agosto · R\$\s1\.639,64 · venceu em 10\/08\/2026/);
  assert.match(text, /Expiram no Inter em até 7 dias \(1\)/);
  assert.match(text, /Cobranças de quem encerrou \(1\):\n- Maxi · Hospedagem · serviço concluído/);
  assert.match(text, /Alertas que não chegam \(1\):\n- x@anuntech\.com · suprimido no Resend/);
});
