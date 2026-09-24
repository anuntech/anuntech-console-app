/* eslint-disable @typescript-eslint/no-require-imports -- Node preload test harness uses CommonJS. */
// Test-process only. Never imported by the application or shipped to Vercel.
// Stands in for OpenRouter: answers with scripted tool calls chosen from the
// last user message, so the assistant's tool loop, permissions and UI can be
// exercised without a real model. Records every request for inspection.
const fs = require("node:fs");
const originalFetch = globalThis.fetch;
const log = process.env.CONSOLE_TEST_ASSISTANT_FILE;

const call = (name, args) => ({
  id: `call_${Math.random().toString(36).slice(2, 10)}`,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});
const reply = (content, tool_calls) => ({
  id: "mock",
  choices: [{ index: 0, message: { role: "assistant", content, tool_calls }, finish_reason: tool_calls ? "tool_calls" : "stop" }],
});

function decide(messages) {
  const user = [...messages].reverse().find((m) => m.role === "user")?.content?.toLowerCase() ?? "";
  const tools = messages.filter((m) => m.role === "tool").map((m) => JSON.parse(m.content));
  const calls = messages.flatMap((m) => m.tool_calls ?? []).map((c) => c.function.name);
  const summarize = () =>
    tools
      .map((t) => (Array.isArray(t) ? t : [t]))
      .flat()
      .slice(0, 5)
      .map((row) => {
        if (row.faturaId) return `- ${row.descricao}: **${row.valor}**, vence ${row.vencimento}, ${row.situacao}${row.linkPagamento ? ` · [pagar](${row.linkPagamento})` : ""}${row.boletoPdf ? ` · [boleto PDF](${row.boletoPdf})` : ""}`;
        if (row.chamadoId) return `- [${row.assunto}](${row.link}) · ${row.situacao}`;
        if (row.engagementId) return `- [${row.nome}](${row.link}) · ${row.tipo} · ${row.situacao}`;
        if (row.nome && row.cnpj) return `- ${row.nome} (${row.cnpj})`;
        if (row.erro) return `- Erro: ${row.erro}`;
        if (row.aberto && row.link) return `- Chamado aberto: [${row.assunto ?? "ver"}](${row.link})`;
        return `- ${JSON.stringify(row).slice(0, 200)}`;
      })
      .join("\n");
  // Second round onwards: chain or finish.
  if (calls.includes("abrir_chamado") || calls.includes("abrir_chat_suporte") || calls.includes("resumo_da_empresa") || calls.includes("abrir_tela"))
    return reply(`Feito.\n\n${summarize()}`);
  if (calls.includes("listar_empresas") && tools.length) {
    const first = tools.flat()[0];
    if (user.includes("chamado")) return reply(null, [call("abrir_chamado", { companyId: first.companyId, assunto: "Teste do assistente", descricao: "Chamado aberto pelo assistente durante o QA." })]);
    if (user.includes("resumo")) return reply(null, [call("resumo_da_empresa", { companyId: first.companyId })]);
  }
  if (tools.length) return reply(`Aqui está o que encontrei:\n\n${summarize()}`);
  // First round: pick a tool from the wording.
  if (user.includes("boleto") || user.includes("fatura")) return reply(null, [call("listar_faturas", { situacao: "todas", limite: 3 })]);
  if (user.includes("falar")) return reply(null, [call("abrir_chat_suporte", {})]);
  if (user.includes("chamado") || user.includes("resumo")) return reply(null, [call("listar_empresas", { limite: 5 })]);
  if (user.includes("projeto")) return reply(null, [call("listar_projetos_e_produtos", {})]);
  if (user.includes("nova cobran")) return reply(null, [call("abrir_tela", { destino: "nova_cobranca" })]);
  if (user.includes("segredo")) return reply(null, [call("criar_projeto", { companyId: "00000000-0000-4000-8000-000000000000", nome: "x" })]);
  return reply(`Recebi: "${user}". Sou o mock do OpenRouter e só sei falar de boletos, chamados, projetos e resumos.`);
}

globalThis.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : input.url;
  if (!url.includes("openrouter.ai")) return originalFetch.apply(this, arguments);
  const body = JSON.parse(init.body);
  if (log) fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), model: body.model, tools: body.tools?.length, messages: body.messages.length }) + "\n");
  const payload = decide(body.messages);
  return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
};
