import assert from "node:assert/strict";
import test from "node:test";
import {
  addBusinessMinutes,
  businessMinutesBetween,
  calendar,
  easter,
  holidaysOf,
  inBusinessHours,
  nextBusinessStart,
} from "../src/lib/service-terms/business-calendar";

const at = (local: string) => new Date(`${local}-03:00`);
const iso = (d: Date) => d.toISOString();
const cal = calendar();

test("Easter and Good Friday fall on the right days", () => {
  assert.equal(easter(2026).toISOString().slice(0, 10), "2026-04-05");
  assert.equal(easter(2027).toISOString().slice(0, 10), "2027-03-28");
  assert.equal(holidaysOf(2026).get("2026-04-03"), "Sexta-feira Santa");
  assert.equal(holidaysOf(2026).get("2026-11-20"), "Dia Nacional de Zumbi e da Consciência Negra");
});

test("Carnaval and Corpus Christi are business days unless the seat says otherwise", () => {
  assert.ok(cal.isBusinessDay("2026-02-17"));
  assert.ok(cal.isBusinessDay("2026-06-04"));
  const seat = calendar({ carnival: true, corpusChristi: true, dates: [{ date: "01-25", name: "Aniversário da cidade" }] });
  assert.equal(seat.isBusinessDay("2026-02-16"), false);
  assert.equal(seat.isBusinessDay("2026-02-17"), false);
  assert.equal(seat.isBusinessDay("2026-06-04"), false);
  assert.equal(seat.isBusinessDay("2027-01-25"), false);
});

test("4 business hours from Friday 17h skip the weekend and 12/10", () => {
  const due = addBusinessMinutes(at("2026-10-09T17:00:00"), 240, cal);
  assert.equal(iso(due), iso(at("2026-10-13T12:00:00")));
  assert.equal(businessMinutesBetween(at("2026-10-09T17:00:00"), due, cal), 240);
});

test("1 business day is 9 business hours, counted from the next opening", () => {
  assert.equal(iso(addBusinessMinutes(at("2026-10-05T10:00:00"), 540, cal)), iso(at("2026-10-06T10:00:00")));
  assert.equal(iso(addBusinessMinutes(at("2026-10-05T20:00:00"), 540, cal)), iso(at("2026-10-06T18:00:00")));
  assert.equal(iso(addBusinessMinutes(at("2026-10-03T11:00:00"), 60, cal)), iso(at("2026-10-05T10:00:00")));
  assert.equal(iso(nextBusinessStart(at("2026-10-03T11:00:00"), cal)), iso(at("2026-10-05T09:00:00")));
});

test("the year turns over a holiday and a weekend", () => {
  assert.equal(iso(addBusinessMinutes(at("2026-12-31T17:00:00"), 120, cal)), iso(at("2027-01-04T10:00:00")));
  assert.equal(businessMinutesBetween(at("2026-12-31T17:00:00"), at("2027-01-04T10:00:00"), cal), 120);
});

test("business hours and empty spans", () => {
  assert.ok(inBusinessHours(at("2026-10-05T09:00:00"), cal));
  assert.equal(inBusinessHours(at("2026-10-05T18:00:00"), cal), false);
  assert.equal(inBusinessHours(at("2026-10-12T10:00:00"), cal), false);
  assert.equal(businessMinutesBetween(at("2026-10-10T10:00:00"), at("2026-10-11T10:00:00"), cal), 0);
  assert.equal(businessMinutesBetween(at("2026-10-06T10:00:00"), at("2026-10-06T09:00:00"), cal), 0);
});
