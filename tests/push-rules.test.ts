import assert from "node:assert/strict";
import test from "node:test";
import {
  PUSH_EVENTS,
  PUSH_TITLE,
  chunk,
  mapPushHttpFailure,
  mapPushReceipt,
  mapPushTicket,
  pickPushRecipients,
  pushBackoffMinutes,
  pushPayload,
  pushStillAllowed,
} from "../src/lib/notifications/push-rules";

test("the lock screen reads the minimal text and opens the item", () => {
  assert.deepEqual(pushPayload("ticket.replied", { id: "t1" }), {
    title: "Anuntech Console",
    body: "Nova resposta no chamado",
    data: { url: "/chamados/t1" },
  });
  assert.equal(pushPayload("ticket.waiting", { id: "t1" }).body, "Seu chamado está aguardando você");
  assert.equal(pushPayload("ticket.resolved", { id: "t1" }).body, "Chamado resolvido");
  assert.deepEqual(pushPayload("invoice.issued", { id: "i1" }).data, { url: "/financeiro/i1" });
  assert.equal(pushPayload("invoice.issued", { id: "i1" }).body, "Nova fatura disponível");
  assert.equal(pushPayload("invoice.overdue", { id: "i1" }).body, "Fatura em atraso");
  assert.deepEqual(pushPayload("contract.sent", { id: "c1" }), {
    title: PUSH_TITLE,
    body: "Contrato para assinar",
    data: { url: "/contratos/c1" },
  });
  assert.deepEqual(pushPayload("quote.sent", { id: "q1" }).data, { url: "/orcamentos/q1" });
  assert.equal(pushPayload("quote.sent", { id: "q1" }).body, "Novo orçamento para responder");
  // A task opens its project's board.
  assert.deepEqual(pushPayload("task.review", { id: "k1", engagementId: "p1" }), {
    title: PUSH_TITLE,
    body: "Entrega pronta para revisar",
    data: { url: "/projetos/p1" },
  });
});

test("no event text carries an amount, a number or a company name", () => {
  for (const spec of Object.values(PUSH_EVENTS)) {
    assert.doesNotMatch(spec.body, /R\$|\d/);
    assert.ok(spec.body.length <= 40);
  }
});

test("only tickets reach Membros; billing, contracts, quotes and reviews go to Administradores", () => {
  for (const [event, spec] of Object.entries(PUSH_EVENTS))
    assert.equal(spec.audience, event.startsWith("ticket.") ? "ticket" : "managers", event);
});

test("recipients: one row per person and phone, never the actor, the team or someone outside the scope", () => {
  const staffEmails = new Set(["team@anuntech.com", "owner@anuntech.com"]);
  const picked = pickPushRecipients(
    [
      { userId: "client", deviceId: "d1", emails: ["a@client.com"], sees: true },
      // The same person through an alias membership, same phone: one push.
      { userId: "client", deviceId: "d1", emails: ["alias@client.com"], sees: false },
      { userId: "client", deviceId: "d2", emails: ["a@client.com"], sees: true },
      { userId: "actor", deviceId: "d3", emails: ["actor@client.com"], sees: true },
      // Team member with a client membership, by an alias.
      { userId: "staff", deviceId: "d4", emails: ["x@client.com", "Team@anuntech.com"], sees: true },
      { userId: "outside", deviceId: "d5", emails: ["m@client.com"], sees: false },
      // A narrow alias and a wide one: the widest scope wins.
      { userId: "wide", deviceId: "d6", emails: ["w1@client.com"], sees: false },
      { userId: "wide", deviceId: "d6", emails: ["w2@client.com"], sees: true },
    ],
    { actorId: "actor", staffEmails },
  );
  assert.deepEqual(
    picked.sort((a, b) => a.deviceId.localeCompare(b.deviceId)),
    [
      { userId: "client", deviceId: "d1" },
      { userId: "client", deviceId: "d2" },
      { userId: "wide", deviceId: "d6" },
    ],
  );
});

test("the re-check before sending follows the ticket scope and the finance area", () => {
  const manager = { role: "manager" as const, engagements: "all" as const };
  const narrow = { role: "member" as const, engagements: new Set(["e1"]) };
  assert.equal(pushStillAllowed("managers", []), false);
  assert.equal(pushStillAllowed("managers", [narrow]), false);
  assert.equal(pushStillAllowed("managers", [manager]), true);
  assert.equal(pushStillAllowed("ticket", [narrow], { engagementId: null, authorId: "x" }, "u"), true);
  assert.equal(pushStillAllowed("ticket", [narrow], { engagementId: "e1", authorId: "x" }, "u"), true);
  assert.equal(pushStillAllowed("ticket", [narrow], { engagementId: "e2", authorId: "x" }, "u"), false);
  // The opener always sees their own ticket.
  assert.equal(pushStillAllowed("ticket", [narrow], { engagementId: "e2", authorId: "u" }, "u"), true);
  assert.equal(pushStillAllowed("ticket", [], { engagementId: null, authorId: "u" }, "u"), false);
  assert.equal(pushStillAllowed("ticket", [manager], null, "u"), false);
});

test("backoff doubles up to an hour", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 20].map(pushBackoffMinutes), [2, 2, 4, 8, 16, 32, 60, 60, 60]);
});

test("Expo's push tickets", () => {
  assert.deepEqual(mapPushTicket({ status: "ok", id: "abc" }), { status: "accepted", providerId: "abc", providerStatus: "ok" });
  const gone = mapPushTicket({ status: "error", message: "x", details: { error: "DeviceNotRegistered" } });
  assert.equal(gone.status, "failed");
  assert.ok(gone.status === "failed" && gone.disableDevice && !gone.alert);
  const rate = mapPushTicket({ status: "error", details: { error: "MessageRateExceeded" } });
  assert.equal(rate.status, "pending");
  const credentials = mapPushTicket({ status: "error", details: { error: "InvalidCredentials" } });
  assert.ok(credentials.status === "failed" && credentials.alert === "InvalidCredentials" && !credentials.disableDevice);
  assert.ok(mapPushTicket({ status: "error", details: { error: "MismatchSenderId" } }).status === "failed");
  // Something we cannot read may have gone out: never repeated.
  assert.equal(mapPushTicket(undefined).status, "uncertain");
  assert.equal(mapPushTicket({ status: "ok" }).status, "uncertain");
});

test("the HTTP answer of a whole batch", () => {
  assert.equal(mapPushHttpFailure(429).status, "pending");
  assert.equal(mapPushHttpFailure(503).status, "pending");
  const token = mapPushHttpFailure(401);
  assert.ok(token.status === "failed" && token.alert === "EXPO_ACCESS_TOKEN");
  assert.equal(mapPushHttpFailure(400).status, "failed");
  // A 2xx without readable tickets, or a timeout (0): may have gone out.
  assert.equal(mapPushHttpFailure(200).status, "uncertain");
  assert.equal(mapPushHttpFailure(0).status, "uncertain");
});

test("Expo's receipts", () => {
  assert.deepEqual(mapPushReceipt({ status: "ok" }), { status: "delivered", providerStatus: "ok" });
  assert.equal(mapPushReceipt(undefined), null);
  const gone = mapPushReceipt({ status: "error", details: { error: "DeviceNotRegistered" } });
  assert.ok(gone?.status === "failed" && gone.disableDevice);
  const big = mapPushReceipt({ status: "error", details: { error: "MessageTooBig" } });
  assert.ok(big?.status === "failed" && big.alert === "MessageTooBig" && !big.disableDevice);
});

test("batches of up to 100 messages", () => {
  const items = Array.from({ length: 250 }, (_, i) => i);
  assert.deepEqual(chunk(items).map((c) => c.length), [100, 100, 50]);
  assert.deepEqual(chunk([]), []);
});
