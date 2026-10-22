import assert from "node:assert/strict";
import test from "node:test";
import {
  JOURNEY_STAGES,
  JOURNEY_TEMPLATE,
  briefingDone,
  briefingSummary,
  contrastRatio,
  currentStage,
  emptyBriefing,
  emptyFacts,
  journeyBriefingSchema,
  looksSecret,
  paletteCss,
  resolveJourney,
  safeUrl,
  swatchContrast,
  type JourneyFacts,
  type StoredStep,
} from "../src/lib/journeys/journey-model";

const j = { id: "00000000-0000-4000-8000-000000000001", ticketId: null };
const row = (key: string, patch: Partial<StoredStep> = {}): StoredStep => ({
  key,
  title: null,
  stage: null,
  status: "todo",
  note: null,
  url: null,
  value: null,
  scheduledAt: null,
  assigneeId: null,
  doneBy: null,
  doneAt: null,
  aiText: null,
  ...patch,
});
const step = (resolved: ReturnType<typeof resolveJourney>, key: string) =>
  resolved.stages.flatMap((s) => [...s.steps, ...s.optional]).find((s) => s.def.key === key)!;

const company: NonNullable<JourneyFacts["company"]> = {
  id: "c1",
  name: "Acme",
  archived: false,
  billingReady: true,
  manager: true,
  managerSignedIn: false,
  terms: false,
};
const acceptedQuote: NonNullable<JourneyFacts["quote"]> = {
  id: "q1",
  number: "2026-007",
  title: "App de visitas",
  status: "accepted",
  phases: 3,
  tasks: 12,
  complete: true,
  upfrontCents: 500000,
  balanceCents: 500000,
  validUntil: "2026-12-01",
  publishedAt: "2026-10-01T12:00:00.000Z",
  decidedAt: "2026-10-03T12:00:00.000Z",
};

test("the template is consistent: unique keys, known stages, dependencies that exist and come first", () => {
  const keys = JOURNEY_TEMPLATE.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
  const stages = new Set(JOURNEY_STAGES.map((s) => s.key));
  for (const def of JOURNEY_TEMPLATE) {
    assert.ok(stages.has(def.stage), def.key);
    for (const before of def.after ?? []) {
      assert.ok(keys.includes(before), `${def.key} depende de ${before}`);
      assert.ok(keys.indexOf(before) < keys.indexOf(def.key) || before === "hospedagem", `${def.key} vem depois de ${before}`);
    }
    // Every step names what done means.
    assert.ok(def.help.length > 20, def.key);
  }
  // Every stage the owner listed is there.
  for (const key of ["cadastro", "briefing", "tarefas", "orcamento", "projeto", "contrato", "repositorio", "vercel", "neon", "design-system", "dominio", "cloudflare", "apresentacao", "revisao", "entrega", "hospedagem"])
    assert.ok(keys.includes(key), key);
});

test("an empty journey starts at the company record, everything after it waits", () => {
  const resolved = resolveJourney(emptyFacts(), [], null, j);
  assert.equal(resolved.next?.def.key, "cadastro");
  assert.equal(step(resolved, "cadastro").status, "ready");
  assert.equal(step(resolved, "cadastro").action?.type, "link");
  assert.equal(step(resolved, "cadastro-cobranca").status, "waiting");
  assert.match(step(resolved, "contrato").detail ?? "", /Depende de: aceite do orçamento/);
  assert.equal(resolved.done, 0);
  assert.ok(resolved.total > 20);
});

test("what the Console knows ticks itself; a manual 'done' on an automatic step changes nothing", () => {
  const facts = { ...emptyFacts(), company, quote: acceptedQuote };
  const resolved = resolveJourney(facts, [row("contrato", { status: "done" })], null, j);
  assert.equal(step(resolved, "cadastro").status, "done");
  assert.equal(step(resolved, "cadastro").by, "data");
  assert.equal(step(resolved, "orcamento-aceito").status, "done");
  assert.match(step(resolved, "orcamento-aceito").detail ?? "", /Aceito em 03\/10\/2026/);
  // Marked by hand, but the Console has no contract: still to do, with the prepared form.
  assert.equal(step(resolved, "contrato").status, "ready");
  assert.deepEqual(step(resolved, "contrato").action, { type: "link", href: "/contratos/novo?orcamento=q1", label: "Preparar contrato" });
  assert.equal(step(resolved, "administrador").status, "doing");
  // Paid infrastructure before the down payment: a warning, never a block.
  assert.equal(step(resolved, "vercel").status, "ready");
  assert.match(step(resolved, "vercel").warning ?? "", /entrada ainda não foi paga/);
  assert.match(step(resolved, "projeto").warning ?? "", /contrato ainda não foi assinado/);
});

test("skipping needs no data, but data that shows a step done wins over the skip", () => {
  const facts = { ...emptyFacts(), company };
  const resolved = resolveJourney(facts, [row("cadastro", { status: "skipped", note: "teste" }), row("nda", { status: "skipped", note: "sem sigilo" })], null, j);
  assert.equal(step(resolved, "cadastro").status, "done");
  assert.equal(step(resolved, "nda").status, "skipped");
  assert.match(step(resolved, "nda").detail ?? "", /Não se aplica: sem sigilo/);
  // A skipped step releases the ones after it.
  const later = resolveJourney(facts, [row("repositorio", { status: "skipped", note: "repo do cliente" })], null, j);
  assert.equal(step(later, "repositorio").status, "skipped");
});

test("the next step skips the setup lane while the main flow has something to do", () => {
  const facts = { ...emptyFacts(), company: { ...company, managerSignedIn: true, terms: true }, quote: acceptedQuote };
  const resolved = resolveJourney(facts, [], null, j);
  assert.notEqual(resolved.next?.def.stage, "setup");
  assert.equal(resolved.next?.def.key, "briefing");
});

test("a proposal with no down payment or no balance counts those steps as done", () => {
  const facts = { ...emptyFacts(), company, quote: { ...acceptedQuote, upfrontCents: 0 } };
  const resolved = resolveJourney(facts, [], null, j);
  assert.equal(step(resolved, "entrada").status, "done");
  assert.match(step(resolved, "entrada").detail ?? "", /não tem entrada/);
  const paid = resolveJourney({ ...facts, quote: acceptedQuote, upfront: { id: "i1", status: "paid", amountCents: 500000 } }, [], null, j);
  assert.equal(step(paid, "entrada").status, "done");
  const issued = resolveJourney({ ...facts, quote: acceptedQuote, upfront: { id: "i1", status: "issued", amountCents: 500000 } }, [], null, j);
  assert.equal(step(issued, "entrada").status, "doing");
});

test("extra steps the team adds are counted, and stored keys that left the template are kept", () => {
  const resolved = resolveJourney(emptyFacts(), [row("extra:abc", { title: "Integração com o ERP", stage: "setup" }), row("passo-antigo", { status: "done" })], null, j);
  const extra = step(resolved, "extra:abc");
  assert.equal(extra.extra, true);
  assert.equal(extra.def.stage, "setup");
  assert.equal(resolved.orphans.length, 1);
  assert.equal(resolved.orphans[0].key, "passo-antigo");
});

test("the briefing is done with the goal and a feature, and becomes the proposal's summary", () => {
  const briefing = journeyBriefingSchema.parse({
    objetivo: "Registrar visitas dos vendedores",
    funcionalidades: ["Check-in com GPS", "Fotos da visita"],
    integracoes: ["ERP"],
    prazoDesejado: "Março",
  });
  assert.equal(briefingDone(emptyBriefing()), false);
  assert.equal(briefingDone(briefing), true);
  const summary = briefingSummary(briefing);
  assert.match(summary, /^Objetivo: Registrar visitas/);
  assert.match(summary, /- Check-in com GPS/);
  assert.ok(summary.length >= 20 && summary.length <= 4000);
  const long = briefingSummary({ ...briefing, funcionalidades: Array.from({ length: 30 }, (_, i) => `${"x".repeat(190)} ${i}`) });
  assert.ok(long.length <= 4000);
  const resolved = resolveJourney(emptyFacts(), [], briefing, j);
  assert.equal(step(resolved, "briefing").status, "done");
});

test("contrast is computed, not trusted", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
  assert.ok(Math.abs(contrastRatio("#777777", "#ffffff") - 4.48) < 0.02);
  assert.equal(swatchContrast("#1d4ed8").text, "#ffffff");
  assert.equal(swatchContrast("#fef3c7").text, "#000000");
  const css = paletteCss({
    paleta: [{ nome: "Primária", hex: "#1D4ED8", uso: "botões" }],
    fontes: { titulos: "Inter", texto: "Inter" },
    raio: "medio",
    tom: "",
    justificativa: "",
  });
  assert.match(css, /--primaria: #1d4ed8;/);
  assert.match(css, /--radius: 0.625rem;/);
});

test("only plain https links are kept: no credentials, no other schemes", () => {
  assert.equal(safeUrl("https://github.com/anuntech/acme"), "https://github.com/anuntech/acme");
  assert.equal(safeUrl("http://github.com/anuntech/acme"), null);
  assert.equal(safeUrl("https://user:senha@example.com"), null);
  assert.equal(safeUrl("postgresql://user:senha@host/db"), null);
  assert.equal(safeUrl("javascript:alert(1)"), null);
});

test("while the proposal waits for the client, the journey stays in Proposta; hosting waits for the acceptance", () => {
  const facts = { ...emptyFacts(), company: { ...company, managerSignedIn: true }, quote: { ...acceptedQuote, status: "sent" as const, decidedAt: null } };
  const briefing = journeyBriefingSchema.parse({ objetivo: "App", funcionalidades: ["Login"] });
  const resolved = resolveJourney(facts, [], briefing, j);
  assert.equal(step(resolved, "hospedagem").status, "waiting");
  assert.notEqual(resolved.next?.def.stage, "entrega");
  assert.equal(currentStage(resolved), "proposta");
  assert.equal(step(resolved, "orcamento-aceito").status, "doing");
});

test("a cancelled proposal counts as none: the journey offers a new one", () => {
  const facts = { ...emptyFacts(), company, quote: { ...acceptedQuote, status: "cancelled" as const } };
  const resolved = resolveJourney(facts, [], null, j);
  assert.equal(step(resolved, "tarefas").status, "ready");
  assert.equal(step(resolved, "tarefas").action?.type, "createQuote");
  assert.equal(step(resolved, "orcamento").status, "waiting");
});

test("secrets are refused in notes, and links carry no key", () => {
  for (const text of [
    "postgresql://user:senha@host/db",
    "mysql://root:pw@db/x",
    "senha do painel: Tr0car!agora",
    "a senha do wordpress é Xk9!pq",
    "RESEND_API_KEY=re_abcdefghijklmnopqrstu",
    "chave ghp_abcdefghijklmnopqrstuvwx",
  ])
    assert.equal(looksSecret(text), true, text);
  for (const text of ["A senha fica no cofre da equipe", "RESEND_API_KEY: chave do Resend", "Banco no projeto acme da Neon"]) assert.equal(looksSecret(text), false, text);
  assert.equal(safeUrl("https://example.com/x?token=abc"), null);
  assert.equal(safeUrl("https://vercel.com/anuntech/acme?tab=settings"), "https://vercel.com/anuntech/acme?tab=settings");
});

test("a budget said in the meeting stays out of the proposal's summary", () => {
  const briefing = journeyBriefingSchema.parse({ objetivo: "App", funcionalidades: ["Login"], restricoes: ["Verba de até R$ 30 mil", "Precisa rodar no Android 10"] });
  const summary = briefingSummary(briefing);
  assert.doesNotMatch(summary, /30 mil/);
  assert.match(summary, /Android 10/);
});
