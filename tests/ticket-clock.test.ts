import assert from "node:assert/strict";
import test from "node:test";
import { calendar } from "../src/lib/service-terms/business-calendar";
import { businessSpanLabel, pauseToAdd, responseRule, ticketDues, visibleToClient } from "../src/lib/service-terms/ticket-clock";
import { presetPolicy } from "../src/lib/service-terms/presets";
import { expectation, outOfHoursLine } from "../src/lib/service-terms/terms-text";
import type { TermsSnapshot } from "../src/lib/service-terms/terms-model";

const at = (local: string) => new Date(`${local}-03:00`);
const cal = calendar();
const snapshot = (preset: string, publishAt: string | null = null): TermsSnapshot => ({
  termsId: "t",
  version: 1,
  label: preset,
  preset,
  policy: presetPolicy(preset)!,
  publishAt,
  personClient: false,
});

test("support: Crítica answers in 4 business hours and aims to solve in 1 business day", () => {
  const dues = ticketDues({ createdAt: at("2026-10-09T17:00:00"), priority: "critical", kind: "problem", impact: "down", terms: snapshot("support") }, cal);
  assert.equal(dues.responseDueAt?.toISOString(), at("2026-10-13T12:00:00").toISOString());
  assert.equal(dues.resolutionDueAt?.toISOString(), at("2026-10-13T17:00:00").toISOString());
});

test("support: Normal answers in 2 business days, with 10 as the goal", () => {
  const dues = ticketDues({ createdAt: at("2026-10-05T10:00:00"), priority: "normal", kind: "question", terms: snapshot("support") }, cal);
  assert.equal(dues.responseDueAt?.toISOString(), at("2026-10-07T10:00:00").toISOString());
  assert.equal(dues.resolutionDueAt?.toISOString(), at("2026-10-20T10:00:00").toISOString());
});

test("a license answers in 1 business day, with no goal and no levels", () => {
  const dues = ticketDues({ createdAt: at("2026-10-05T10:00:00"), priority: "critical", kind: "problem", impact: "down", terms: snapshot("synova") }, cal);
  assert.equal(dues.responseDueAt?.toISOString(), at("2026-10-06T10:00:00").toISOString());
  assert.equal(dues.resolutionDueAt, null);
});

test("infra and e-mail get 4 business hours when the whole service is down", () => {
  const policy = presetPolicy("infra")!;
  assert.equal(responseRule(policy, "normal", "down")?.firstResponseMinutes, 240);
  assert.equal(responseRule(policy, "normal", "other")?.firstResponseMinutes, 540);
});

test("no conditions, or a new project, means no deadline", () => {
  assert.deepEqual(ticketDues({ createdAt: at("2026-10-05T10:00:00"), priority: "high", terms: null }, cal), { responseDueAt: null, resolutionDueAt: null });
  assert.deepEqual(ticketDues({ createdAt: at("2026-10-05T10:00:00"), priority: "normal", kind: "new_project", terms: snapshot("support") }, cal), { responseDueAt: null, resolutionDueAt: null });
});

test("waiting for the client pauses only where the contract says so", () => {
  const since = at("2026-10-05T10:00:00"), now = at("2026-10-06T10:00:00");
  assert.equal(pauseToAdd(snapshot("support"), since, now, cal), 540);
  assert.equal(pauseToAdd(snapshot("synova"), since, now, cal), 0);
  const paused = ticketDues({ createdAt: at("2026-10-05T09:00:00"), priority: "normal", kind: "question", pausedMinutes: 540, terms: snapshot("support") }, cal);
  assert.equal(paused.responseDueAt?.toISOString(), at("2026-10-07T18:00:00").toISOString());
});

test("clients see dates only once the terms are published", () => {
  assert.ok(visibleToClient(snapshot("support", null), new Date()));
  assert.equal(visibleToClient(snapshot("support", "2999-01-01T00:00:00Z"), new Date()), false);
  assert.equal(visibleToClient(null, new Date()), false);
});

test("spans read like the contracts", () => {
  assert.equal(businessSpanLabel(240), "4 horas úteis");
  assert.equal(businessSpanLabel(540), "1 dia útil");
  assert.equal(businessSpanLabel(1080), "2 dias úteis");
  assert.equal(businessSpanLabel(60), "1 hora útil");
});

test("deadlines read as day and hour in São Paulo", async () => {
  const { dueLabel } = await import("../src/lib/format");
  const now = at("2026-10-09T10:00:00");
  assert.equal(dueLabel(at("2026-10-09T15:00:00"), now), "hoje, 15h");
  assert.equal(dueLabel(at("2026-10-10T09:30:00"), now), "amanhã, 9h30");
  assert.equal(dueLabel(at("2026-10-13T12:00:00"), now), "ter. 13/10, 12h");
});

test("a request for something new gets a first response but no goal", () => {
  const dues = ticketDues({ createdAt: at("2026-10-05T10:00:00"), priority: "normal", kind: "change", terms: snapshot("support") }, cal);
  assert.equal(dues.responseDueAt?.toISOString(), at("2026-10-07T10:00:00").toISOString());
  assert.equal(dues.resolutionDueAt, null);
  const text = expectation(snapshot("support"), "change", null, at("2026-10-05T10:00:00"), cal);
  assert.equal(text.lines.some((l) => l.startsWith("Meta")), false);
});

test("after hours, the deadline line appears only when there is a deadline", () => {
  const night = at("2026-10-05T22:00:00");
  assert.equal(outOfHoursLine(night, cal), "A equipe volta às 9h de amanhã.");
  assert.match(outOfHoursLine(night, cal, true) ?? "", /O prazo começa a contar a partir daí\.$/);
  assert.equal(outOfHoursLine(at("2026-10-05T10:00:00"), cal), null);
});
