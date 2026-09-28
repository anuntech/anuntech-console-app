import assert from "node:assert/strict";
import test from "node:test";
import {
  ticketFilterStatuses,
  ticketListHref,
  ticketQuery,
} from "../src/lib/tickets/ticket-table";

test("ticket list defaults to what needs attention and rejects malformed parameters", () => {
  assert.deepEqual(ticketQuery({}), {
    status: "active",
    search: "",
    company: "",
    page: 1,
    pageSize: 25,
  });
  assert.equal(ticketQuery({ status: "closed" }).status, "closed");
  assert.equal(ticketQuery({ status: "all" }).status, "all");
  assert.equal(ticketQuery({ status: "inventado" }).status, "active");
  assert.equal(ticketQuery({ status: ["all", "closed"] }).status, "active");
  assert.equal(
    ticketQuery({ company: "0352E874-BF22-4F3A-8590-CCE8170B86DC" }).company,
    "0352e874-bf22-4f3a-8590-cce8170b86dc",
  );
  assert.equal(ticketQuery({ company: "1 or 1=1" }).company, "");
  assert.equal(ticketQuery({ page: "-3" }).page, 1);
  assert.equal(ticketQuery({ page: "2.5" }).page, 1);
  assert.equal(ticketQuery({ size: "9999" }).pageSize, 25);
  assert.equal(ticketQuery({ size: "10" }).pageSize, 10);
  assert.equal(ticketQuery({ q: `  ${"a".repeat(200)}  ` }).search.length, 160);
});

test("filters expand to the statuses they stand for", () => {
  assert.deepEqual(ticketFilterStatuses("active"), [
    "open",
    "in_progress",
    "waiting_customer",
  ]);
  assert.deepEqual(ticketFilterStatuses("resolved"), ["resolved"]);
  assert.equal(ticketFilterStatuses("all"), undefined);
});

test("ticket list links keep only the parameters that differ from the defaults", () => {
  assert.equal(
    ticketListHref({
      status: "active",
      search: "",
      company: "",
      page: 1,
      pageSize: 25,
    }),
    "/chamados",
  );
  assert.equal(
    ticketListHref({
      status: "closed",
      search: "nota fiscal",
      company: "0352e874-bf22-4f3a-8590-cce8170b86dc",
      page: 2,
      pageSize: 50,
    }),
    "/chamados?status=closed&company=0352e874-bf22-4f3a-8590-cce8170b86dc&q=nota+fiscal&page=2&size=50",
  );
});
