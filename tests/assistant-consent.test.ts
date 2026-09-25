import assert from "node:assert/strict";
import test from "node:test";
import { plainApproval } from "../src/lib/assistant-consent";

const asked = {
  role: "assistant",
  content: "Vou atribuir Kauan Ketner como responsável pelas 32 tarefas do projeto Sistema de controle de OS/OR. Confirma?",
};
const reply = (content: string) => [{ role: "user", content: "coloque eu como responsável" }, asked, { role: "user", content }];

test("a plain yes right after the assistant asks is consent", () => {
  for (const yes of ["sim", "Sim!", "confirmo", "pode", "ok", "Faça", "sim, pode atualizar todas", "sim, atribua-me às 32 tarefas", "isso mesmo"])
    assert.equal(plainApproval(reply(yes)), true, yes);
});

test("a yes with a condition or a new request still needs the check", () => {
  for (const other of [
    "sim, mas só as três primeiras",
    "não",
    "pode, exceto as concluídas",
    "sim, só as abertas",
    "ok, mas troca o prazo para sexta",
    "quais são as tarefas?",
    "sim ".repeat(30),
  ])
    assert.equal(plainApproval(reply(other)), false, other);
});

test("a yes counts only as the answer to a question the assistant just asked", () => {
  assert.equal(plainApproval([{ role: "user", content: "sim" }]), false);
  assert.equal(plainApproval([{ role: "assistant", content: "Pronto, atribuí as tarefas." }, { role: "user", content: "sim" }]), false);
  assert.equal(plainApproval([asked, { role: "user", content: "sim" }, { role: "assistant", content: "Feito." }]), false);
});
