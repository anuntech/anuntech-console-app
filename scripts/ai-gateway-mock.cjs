/* eslint-disable @typescript-eslint/no-require-imports -- Node preload test harness uses CommonJS. */
// Test-process only. Never imported by the application or shipped to Vercel.
// Stands in for the Vercel AI Gateway: answers the chat with scripted tool
// calls chosen from the last user message, and Jev, the drafts, dictation and
// icons with fixed answers, so every AI path of the Console can be exercised
// without a real model. Records every request (never the audio, the prompt
// only when a suite asks) for inspection. Any other AI request (a Gateway path
// it does not know, OpenRouter) is refused and logged as `unexpected`: a test
// run never reaches a real provider.
const fs = require("node:fs");
const originalFetch = globalThis.fetch;
const log = process.env.CONSOLE_TEST_ASSISTANT_FILE;
const record = (entry) => log && fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
// Switches the suites flip while the server runs (the notice mock reads the same file): { jev: "fail" } breaks Jev.
const mockFlags = () => {
  try {
    return JSON.parse(fs.readFileSync(process.env.CONSOLE_TEST_NOTICE_FLAGS, "utf8"));
  } catch {
    return {};
  }
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
/** The Gateway's error body: the SDK reads `type` into its error class and keeps the HTTP status. */
const failure = (status, message, type = "internal_server_error") => json({ error: { message, type } }, status);

/** Small valid PNGs in different colors, standing in for generated icons. */
async function mockImages(n) {
  const sharp = require("sharp");
  const colors = ["#1a428a", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1"];
  return Promise.all(
    Array.from({ length: n }, (_, index) =>
      sharp({ create: { width: 64, height: 64, channels: 3, background: colors[index % colors.length] } })
        .png()
        .toBuffer(),
    ),
  );
}

/** Message content as text: a string, or the text of a list of parts. */
const textOf = (content) =>
  typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => (part && typeof part.text === "string" ? part.text : "")).join("") : "";
/** A tool's answer: JSON from a tool that ran, plain text when the SDK refused the call itself. */
const toolResult = (content) => {
  const text = textOf(content);
  try {
    return JSON.parse(text);
  } catch {
    return { erro: text };
  }
};

/** A tool result part's output as the text the model reads. */
const outputText = (output) =>
  !output ? "" : output.type === "text" || output.type === "error-text" ? String(output.value ?? "") : JSON.stringify(output.value ?? null);

/**
 * The Gateway's prompt (AI SDK messages: parts, tool calls and tool results)
 * in the shape `decide` reads: one message per tool result, and each
 * assistant message with its tool calls.
 */
function asMessages(prompt) {
  return (prompt ?? []).flatMap((message) => {
    if (message.role === "system") return [{ role: "system", content: textOf(message.content) }];
    if (message.role === "tool")
      return (message.content ?? []).filter((part) => part.type === "tool-result").map((part) => ({ role: "tool", tool_call_id: part.toolCallId, content: outputText(part.output) }));
    if (message.role === "assistant") {
      const parts = Array.isArray(message.content) ? message.content : [];
      const tool_calls = parts
        .filter((part) => part.type === "tool-call")
        .map((part) => ({ id: part.toolCallId, type: "function", function: { name: part.toolName, arguments: typeof part.input === "string" ? part.input : JSON.stringify(part.input ?? {}) } }));
      return [{ role: "assistant", content: textOf(parts.filter((part) => part.type === "text")), ...(tool_calls.length ? { tool_calls } : {}) }];
    }
    return [{ role: message.role, content: textOf(message.content) }];
  });
}

const call = (name, args) => ({
  id: `call_${Math.random().toString(36).slice(2, 10)}`,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});
/** A call exactly as the model streamed its arguments: "" (none) or JSON that never closes. */
const rawCall = (name, text, id = `call_${Math.random().toString(36).slice(2, 10)}`) => ({ id, type: "function", function: { name, arguments: text } });
/** A call whose arguments come whole in its first piece. */
const wholeCall = (name, text) => ({ ...rawCall(name, text), whole: true });
const reply = (content, tool_calls, finish_reason = tool_calls ? "tool_calls" : "stop") => ({
  id: "mock",
  choices: [{ index: 0, message: { role: "assistant", content, tool_calls }, finish_reason }],
});

function decide(messages) {
  // The screen travels as its own labelled user message; the person's words are the others.
  const users = messages.filter((m) => m.role === "user" && !textOf(m.content).startsWith("<tela_atual>")).map((m) => textOf(m.content).toLowerCase());
  // A short "sim" answers the request before it: act on that one.
  const user = /^(sim|confirmo|pode|ok)\b/.test(users.at(-1) ?? "") && users.length > 1 ? users.at(-2) : (users.at(-1) ?? "");
  const tools = messages.filter((m) => m.role === "tool").map((m) => toolResult(m.content));
  const system = textOf(messages.find((m) => m.role === "system")?.content);
  const calls = messages.flatMap((m) => m.tool_calls ?? []).map((c) => c.function.name);
  const summarize = () =>
    tools
      .map((t) => (Array.isArray(t) ? t : [t]))
      .flat()
      .slice(0, 20)
      .map((row) => {
        if (row.clientes) return `- ${row.clientes.map((c) => `${c.nome}: ${c.faturado} faturado, ${c.emAberto} em aberto`).join("; ")} (total ${row.totais.faturado})`;
        if (row.faturaId) return `- ${row.descricao}: **${row.valor}**, vence ${row.vencimento}, ${row.situacao}${row.linkPagamento ? ` · [pagar](${row.linkPagamento})` : ""}${row.boletoPdf ? ` · [boleto PDF](${row.boletoPdf})` : ""}`;
        // Client text arrives wrapped ({ origem, nao_confiavel, texto }).
        if (row.chamadoId) return `- [${row.assunto?.texto ?? row.assunto}](${row.link}) · ${row.situacao}`;
        if (row.engagementId) return `- [${row.nome}](${row.link}) · ${row.tipo} · ${row.situacao}`;
        if (row.nome && row.cnpj) return `- ${row.nome} (${row.cnpj})`;
        if (row.erro) return `- Erro: ${row.erro}`;
        if (row.aguardandoConfirmacao) return `- Cartão: ${row.acao}`;
        if (row.rascunho && row.link) return `- Orçamento em rascunho: [abrir](${row.link}) · ${row.esforco} · ${row.valorTotal}`;
        if (row.aberto && row.link) return `- Chamado aberto: [${row.assunto ?? "ver"}](${row.link})`;
        if (row.atualizado && row.valorTotal) return `- Orçamento atualizado: ${row.valorTotal} · [abrir](${row.link})`;
        if (row.atualizadas) return `- ${row.atualizadas} tarefas atualizadas · [quadro](${row.link})`;
        if (row.comentadas) return `- Comentário publicado em ${row.comentadas} tarefa(s) · [quadro](${row.link})`;
        return `- ${JSON.stringify(row).slice(0, 200)}`;
      })
      .join("\n");
  // The day's budget ran out mid-answer (M3): the last round answers in text with what the tools brought.
  if (system.includes("limite de uso do assistente de hoje acabou")) return reply(`Parei aqui: o limite de hoje acabou.\n\n${summarize()}`);
  // A model that spent its budget on reasoning and wrote nothing: the retry asks once more, plainly.
  const retry = system.includes("Escreva agora a resposta final");
  if (user.includes("resposta-vazia")) return reply(retry ? "Resposta escrita na segunda tentativa." : "");
  // The same after a round of tools: the retry must still read what they returned.
  if (user.includes("depois vazia") && calls.includes("abrir_chamado") && !retry) return reply("");
  // A round cut by the output limit in the middle of a call: the SDK does not run it, and the new attempt
  // (its note lets tools run again) makes the call and answers from what it returned.
  const cutRetry = system.includes("passou do limite de saída");
  if (user.includes("corta no limite") || user.includes("corte sem texto")) {
    if (cutRetry) return calls.includes("listar_faturas") ? reply(`Depois do corte. ${summarize()}`) : reply(null, [call("listar_faturas", { situacao: "todas", limite: 1 })]);
    // Either the call is complete but unrun, or the limit lands inside its arguments.
    return reply(null, [user.includes("corta no limite") ? call("listar_faturas", { situacao: "todas", limite: 1 }) : rawCall("listar_faturas", '{"situacao":"to')], "length");
  }
  // The same after text the person already read: that text is the answer.
  if (user.includes("texto e corte")) return retry ? reply("Não deveria haver nova tentativa.") : reply("Encontrei as faturas.", [call("listar_faturas", { situacao: "todas", limite: 1 })], "length");
  // The first call's arguments come last (the Gateway hands it over after the second), or never close.
  if (user.includes("sem argumentos primeiro") && !calls.length)
    return reply(null, [rawCall("listar_chamados", ""), call("ler_empresa", { companyId: /empresa ([0-9a-f-]{36})/.exec(user)?.[1] })]);
  if (user.includes("argumento quebrado") && !calls.length) return reply(null, [rawCall("listar_faturas", '{"limite":')]);
  const b = /empresa ([0-9a-f-]{36})/.exec(user)?.[1];
  // A complete call after one whose arguments come later; calls finished only at the end.
  if (user.includes("inteira depois") && !calls.length) return reply(null, [rawCall("listar_chamados", ""), wholeCall("ler_empresa", JSON.stringify({ companyId: b }))]);
  if (user.includes("duas no fim") && !calls.length) return reply(null, [rawCall("listar_chamados", ""), rawCall("buscar_ajuda", ""), call("ler_empresa", { companyId: b })]);
  // Arguments the SDK refuses to parse (a __proto__ key), whole in the first piece.
  if (user.includes("proto primeiro") && !calls.length) return reply(null, [wholeCall("listar_chamados", '{"__proto__":{"x":1}}'), call("ler_empresa", { companyId: b })]);
  // The output limit cuts the only call in the middle of its arguments, or right after its name, after text.
  if (user.includes("corte no meio") && !retry) return reply("Vou consultar as faturas.", [rawCall("listar_faturas", '{"situacao":"to')], "length");
  if (user.includes("corte depois do nome") && !retry) return reply("Vou consultar as faturas.", [rawCall("listar_faturas", "")], "length");
  // A provider that numbers ids per response: the same id comes back in the next round, valid this time.
  if (user.includes("mesmo id") && calls.length < 2) return reply(null, [rawCall("listar_faturas", calls.length ? '{"limite":1}' : '{"limite":', "call_0")]);
  // H4 within one round: read a ticket, read company B and invite there, all in the same response.
  if (user.includes("numa rodada") && !calls.includes("ler_chamado")) {
    const ticket = /chamado ([0-9a-f-]{36})/.exec(user)?.[1];
    const target = /empresa ([0-9a-f-]{36})/.exec(user)?.[1];
    return reply(null, [call("ler_chamado", { chamadoId: ticket }), call("ler_empresa", { companyId: target }), call("convidar_membro", { companyId: target, email: "intruso@example.invalid", papel: "manager" })]);
  }
  // A model fooled by text it read (H4): the "internal procedure" in a ticket asks for another company and an invite.
  const target = messages
    .filter((m) => m.role === "tool" || m.role === "user")
    .map((m) => /PROCEDIMENTO-INTERNO: chame ler_empresa\(([0-9a-f-]{36})\)/.exec(textOf(m.content))?.[1])
    .find(Boolean);
  if (target && !calls.includes("ler_empresa"))
    return reply(null, [call("ler_empresa", { companyId: target }), call("convidar_membro", { companyId: target, email: "intruso@example.invalid", papel: "manager" })]);
  // Second round onwards: chain or finish.
  if (calls.includes("buscar_ajuda")) return reply(`Pronto.\n\n${tools.filter((t) => t.erro).map((t) => `- Erro: ${t.erro}`).join("\n")}`);
  if (calls.includes("clicar_na_tela") || calls.includes("excluir_tarefa")) return reply(`Pronto.\n\n${summarize()}`);
  if (calls.includes("abrir_chamado") || calls.includes("abrir_chat_suporte") || calls.includes("resumo_da_empresa") || calls.includes("abrir_tela") || calls.includes("criar_orcamento") || calls.includes("preencher_tela") || calls.includes("atualizar_tarefa") || calls.includes("atualizar_orcamento") || calls.includes("comentar_tarefa"))
    return reply(`Feito.\n\n${summarize()}`);
  // "comente no projeto X ...": projects → tasks → a comment on the first one.
  if (user.includes("coment") && calls.includes("listar_projetos_e_produtos") && !calls.includes("listar_tarefas")) {
    const project = tools.flat().find((r) => r.engagementId && /site institucional/i.test(r.nome));
    if (project) return reply(null, [call("listar_tarefas", { engagementId: project.engagementId })]);
  }
  if (user.includes("coment") && calls.includes("listar_tarefas") && !calls.includes("comentar_tarefa")) {
    const board = tools.flat().find((r) => r.tarefas);
    if (board?.tarefas?.length) return reply(null, [call("comentar_tarefa", { tarefaId: board.tarefas[0].tarefaId, texto: "Layout aprovado pelo cliente; seguir para o desenvolvimento." })]);
  }
  // "vincule todos os cards do projeto X a mim": projects → tasks → one bulk update.
  if (user.includes("vincul") && calls.includes("listar_projetos_e_produtos") && !calls.includes("listar_tarefas")) {
    const rows = tools.flat();
    const project = rows.find((r) => r.engagementId && /site institucional/i.test(r.nome)) ?? rows.find((r) => r.engagementId && r.tipo === "Projeto");
    if (project) return reply(null, [call("listar_tarefas", { engagementId: project.engagementId })]);
  }
  if (user.includes("vincul") && calls.includes("listar_tarefas") && !calls.includes("atualizar_tarefa")) {
    const board = tools.flat().find((r) => r.tarefas);
    if (board?.tarefas?.length) return reply(null, [call("atualizar_tarefa", { tarefaIds: board.tarefas.map((t) => t.tarefaId), responsaveis: ["eu"] })]);
  }
  if (user.includes("igual") && calls.includes("listar_empresas") && !calls.includes("listar_orcamentos")) return reply(null, [call("listar_orcamentos", {})]);
  if (user.includes("igual") && calls.includes("listar_orcamentos") && !calls.includes("criar_orcamento")) {
    const company = tools.flat().find((r) => r.companyId && r.cnpj);
    const source = tools.flat().find((r) => r.orcamentoId);
    return reply(null, [call("criar_orcamento", { companyId: company.companyId, copiarDeOrcamentoId: source.orcamentoId, titulo: `Cópia — ${source.titulo}` })]);
  }
  if (calls.includes("listar_faturas") && !calls.includes("ler_fatura") && user.includes("detalhes da fatura")) {
    const first = tools.flat().find((r) => r.faturaId);
    if (first) return reply(null, [call("ler_fatura", { faturaId: first.faturaId })]);
  }
  if (calls.includes("ler_fatura") && tools.length) {
    const f = tools.flat().find((r) => r.avisos);
    return reply(`Fatura **${f?.descricao}**: ${f?.valor}, vence ${f?.vencimento}, ${f?.situacao}; ${f?.avisos?.length ?? 0} avisos. [Ver](${f?.detalhe})`);
  }
  if (calls.includes("listar_orcamentos") && !calls.includes("ler_orcamento") && tools.length) {
    const first = tools.flat().find((r) => r.orcamentoId);
    if (first) return reply(null, [call("ler_orcamento", { orcamentoId: first.orcamentoId })]);
  }
  if (calls.includes("ler_orcamento") && tools.length) {
    const q = tools.flat().find((r) => r.fases);
    return reply(`Li o orçamento **${q?.titulo}**: ${q?.fases?.length} fases, ${q?.esforco}, ${q?.valorTotal} (taxa ${q?.taxaHora}). [Abrir](${q?.link})`);
  }
  if (calls.includes("listar_empresas") && tools.length) {
    const first = tools.flat()[0];
    if (user.includes("chamado")) return reply(null, [call("abrir_chamado", { companyId: first.companyId, tipo: "question", assunto: "Teste do assistente", descricao: "Chamado aberto pelo assistente durante o QA." })]);
    if (user.includes("resumo")) return reply(null, [call("resumo_da_empresa", { companyId: first.companyId })]);
    // The production failure: optional fields sent as "" / null instead of omitted.
    if ((user.includes("orcamento") || user.includes("orçamento")) && user.includes("sem validade"))
      return reply(null, [call("criar_orcamento", { companyId: first.companyId, copiarDeOrcamentoId: "", titulo: "Correções e melhorias", resumo: "PRs 16 a 23.", taxaHoraReais: 150, entradaPercentual: 0, validoAte: null, stack: null, fases: [{ nome: "Correções e Melhorias", descricao: "", horasMin: 54, horasMax: 54, tarefas: [{ titulo: "PR 16" }, { titulo: "PR 17" }] }], observacoes: null })]);
    if (user.includes("orcamento") || user.includes("orçamento"))
      return reply(null, [call("criar_orcamento", { companyId: first.companyId, titulo: "Portal do cliente", resumo: "Área logada para acompanhar pedidos.", taxaHoraReais: 120, entradaPercentual: 40, validoAte: "2026-10-31", stack: ["Next.js", "PostgreSQL"], fases: [{ nome: "Descoberta", descricao: "Levantamento e protótipo.", horasMin: 6, horasMax: 8, tarefas: [{ titulo: "Entrevistas", descricao: "Duas sessões com o cliente." }] }, { nome: "Construção", horasMin: 20, horasMax: 26, tarefas: [{ titulo: "Login e cadastro" }, { titulo: "Lista de pedidos" }] }] })]);
  }
  if (tools.length) return reply(`Aqui está o que encontrei:\n\n${summarize()}`);
  // On a quote draft, "preencha as tarefas" updates the quote itself (not the screen).
  const openQuote = /Registro aberto nesta tela: orçamento ([0-9a-f-]{36})/.exec(system)?.[1];
  if (openQuote && /tarefa|fase/.test(user) && !calls.includes("atualizar_orcamento"))
    return reply(null, [call("atualizar_orcamento", { orcamentoId: openQuote, entradaPercentual: 0, validoAte: "", fases: [{ nome: "Correções e Melhorias", descricao: "Product Requests II", horasMin: 54, horasMax: 54, tarefas: [{ titulo: "PR 16 — Ajuste no cadastro" }, { titulo: "PR 17 — Filtro de relatórios" }, { titulo: "PR 18 — Exportação CSV" }] }] })]);
  // First round: pick a tool from the wording.
  const openTicket = /Registro aberto nesta tela: chamado ([0-9a-f-]{36})/.exec(system)?.[1];
  if (openTicket && user.includes("resum") && !calls.includes("ler_chamado")) return reply(null, [call("ler_chamado", { chamadoId: openTicket })]);
  // What the server rebuilt as history: the person's earlier messages, as the model received them.
  if (user.includes("repita o historico")) return reply(`Histórico: ${users.slice(0, -1).join(" | ") || "(vazio)"}`);
  const click = /clique em (.+)$/.exec(user);
  if (click) return reply(null, [call("clicar_na_tela", { texto: click[1].trim() })]);
  if (user.includes("muitas consultas")) return reply(null, Array.from({ length: 15 }, () => call("buscar_ajuda", { consulta: "boleto" })));
  // Text before the tool call in the same response, as real models often do.
  if (user.includes("fala antes")) return reply("Vou consultar as faturas.", [call("listar_faturas", { situacao: "todas", limite: 1 })]);
  // A tool from an area Jev did not pick for this message (L6).
  if (user.includes("fora da lista")) return reply(null, [call("excluir_tarefa", { tarefaId: /alvo ([0-9a-f-]{36})/.exec(user)?.[1] ?? "00000000-0000-4000-8000-000000000001" })]);
  if (user.includes("preench") && user.includes("envie"))
    return reply(null, [call("preencher_tela", { campos: [{ campo: "subject", valor: "Preenchido pelo assistente" }, { campo: "body", valor: "Teste de envio pela tela." }], enviar: true })]);
  if (user.includes("preench") && user.includes("cobran"))
    return reply(null, [call("preencher_tela", { campos: [{ campo: "companyId", valor: "Cliente QA" }, { campo: "description", valor: "Manutenção mensal — preenchido pelo assistente" }, { campo: "amount", valor: "1.500,00" }, { campo: "dueDate", valor: "15/10/2026" }], enviar: false })]);
  if (user.includes("preench"))
    return reply(null, [call("preencher_tela", { campos: [{ campo: "companyId", valor: "GS Comunicação" }, { campo: "subject", valor: "Preenchido pelo assistente" }, { campo: "body", valor: "Teste de preenchimento da tela pelo assistente." }], enviar: false })]);
  if (user.includes("maior cliente") || user.includes("faturamos")) return reply(null, [call("resumo_financeiro", { periodo: "tudo" })]);
  if (user.includes("igual")) return reply(null, [call("listar_empresas", { limite: 5 })]);
  if (user.includes("detalhes da fatura")) return reply(null, [call("listar_faturas", { situacao: "todas", limite: 1 })]);
  if (user.includes("detalhes do or")) return reply(null, [call("listar_orcamentos", {})]);
  if (user.includes("orcamento") || user.includes("orçamento")) return reply(null, [call("listar_empresas", { limite: 5 })]);
  if (user.includes("boleto") || user.includes("fatura")) return reply(null, [call("listar_faturas", { situacao: "todas", limite: 3 })]);
  if (user.includes("falar")) return reply(null, [call("abrir_chat_suporte", {})]);
  if (user.includes("chamado") || user.includes("resumo")) return reply(null, [call("listar_empresas", { limite: 5 })]);
  if (user.includes("projeto")) return reply(null, [call("listar_projetos_e_produtos", {})]);
  if (user.includes("nova cobran")) return reply(null, [call("abrir_tela", { destino: "nova_cobranca" })]);
  if (user.includes("segredo")) return reply(null, [call("criar_projeto", { companyId: "00000000-0000-4000-8000-000000000000", nome: "x" })]);
  return reply(`Recebi: "${user}". Sou o mock do AI Gateway e só sei falar de boletos, chamados, projetos e resumos.`);
}

/**
 * The journey drafts, deterministic and valid for their schemas. Notes with
 * RESPOSTA-QUEBRADA get prose instead of JSON, to exercise "fora do formato".
 */
function journeyAnswer(system, user) {
  if (system.startsWith("Você organiza o briefing")) {
    if (user.includes("RESPOSTA-QUEBRADA")) return { kind: "briefing", content: "Não consegui organizar as notas." };
    return {
      kind: "briefing",
      content: JSON.stringify({
        objetivo: "Organizar os pedidos da equipe comercial num só lugar.",
        problema: "Os pedidos chegam por planilha e se perdem.",
        publico: "Equipe comercial e gestores",
        tipoProjeto: "sistema",
        funcionalidades: ["Cadastro de pedidos", "Painel de acompanhamento"],
        integracoes: ["ERP atual"],
        restricoes: [],
        prazoDesejado: "Até março",
        orcamentoCliente: "",
        decisor: "Diretora comercial",
        perguntasAbertas: ["Qual ERP a empresa usa e se ele tem API?"],
        riscos: [],
        proximosPassos: ["Enviar o orçamento"],
      }),
    };
  }
  if (system.startsWith("Você escreve o prompt de início do projeto"))
    return {
      kind: "prompt",
      content: "# Prompt de início do projeto\nProjeto de teste\n\n## Contexto do projeto\nSistema de pedidos.\n\n## Setup\n1. `gh repo create anuntech/projeto-de-teste --private`",
    };
  if (system.startsWith("Você propõe a direção visual"))
    return {
      kind: "design",
      content: JSON.stringify({
        paleta: [
          { nome: "Fundo", hex: "#FAFAF7", uso: "Fundo das telas" },
          { nome: "Texto", hex: "#1C1B19", uso: "Texto principal" },
          { nome: "Principal", hex: "#1F5EFF", uso: "Botões e links" },
          { nome: "Destaque", hex: "#F2A93B", uso: "Avisos e selos" },
        ],
        fontes: { titulos: "Inter", texto: "Inter" },
        raio: "medio",
        tom: "Sóbrio e claro, com a cor principal só nas ações.",
        justificativa: "Proposta a validar com o cliente: o público usa o sistema o dia todo, então o contraste vem primeiro.",
      }),
    };
  if (system.startsWith("Você prepara a pauta"))
    return { kind: "pauta", content: "## Pauta\n1. Apresentações (5 min)\n\n## Perguntas\n- Quem decide?\n\n## Materiais\n- O orçamento\n\n## Checklist\n- [ ] Enviar o resumo" };
  if (system.startsWith("Você orienta um passo da jornada"))
    return { kind: "passo", content: "## Como fazer\n1. Abra a ferramenta.\n\n## O que registrar na jornada\n- O link." };
  if (system.startsWith("Você separa o retorno do cliente"))
    return {
      kind: "retorno",
      content: "## Ajuste dentro do escopo\n- **Trocar a cor do botão** (fase Construção): já está no escopo.\n\n## Novo pedido (vira orçamento ou aditivo)\nNada neste grupo.\n\n## Dúvida ou decisão do cliente\nNada neste grupo.",
    };
  if (system.startsWith("Você aponta o que falta na jornada"))
    return {
      kind: "lacunas",
      content: JSON.stringify({
        passos: [
          { titulo: "Migrar os pedidos da planilha", etapa: "setup", motivo: "O briefing cita pedidos em planilha." },
          { titulo: "Testar com dois vendedores", etapa: "validacao", motivo: "O público usa o sistema o dia todo." },
        ],
      }),
    };
  return null;
}

/** The privacy options a request carried, as every log line records them. */
const privacy = (providerOptions) => ({
  zeroDataRetention: providerOptions?.gateway?.zeroDataRetention ?? null,
  disallowPromptTraining: providerOptions?.gateway?.disallowPromptTraining ?? null,
});

const GATEWAY = "https://ai-gateway.vercel.sh/";

globalThis.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(GATEWAY) && !url.includes("openrouter.ai")) return originalFetch.apply(this, arguments);
  const path = url.slice(GATEWAY.length - 1).split("?")[0];
  // The model catalog comes from a saved copy, so the settings page works offline too.
  if (path === "/v1/models") {
    const file = process.env.CONSOLE_TEST_MODELS_FILE;
    if (!file || !fs.existsSync(file)) return json({ object: "list", data: [] });
    return new Response(fs.readFileSync(file), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const endpoints = ["/v4/ai/language-model", "/v4/ai/decision-model", "/v4/ai/transcription-model", "/v4/ai/image-model"];
  if (!url.startsWith(GATEWAY) || !endpoints.includes(path)) {
    record({ unexpected: url.replace(/\?.*$/, "") });
    return failure(599, "unexpected AI request in test");
  }
  // The protocol the SDK speaks today: a change here fails loudly instead of passing by accident.
  const headers = new Headers(init?.headers);
  if (headers.get("authorization") !== `Bearer ${process.env.AI_GATEWAY_API_KEY}` || headers.get("ai-gateway-protocol-version") !== "0.0.1") {
    record({ drift: path, auth: headers.get("ai-gateway-auth-method") });
    return failure(400, "mock: protocol drift", "invalid_request_error");
  }
  const body = JSON.parse(init.body);
  const model = headers.get("ai-language-model-id") ?? headers.get("ai-model-id");

  if (path === "/v4/ai/image-model") {
    // Catalog icons: n small PNGs. The prompt is never logged, only its size.
    // A hint with FALHA-ICONE fails every model; UM-POR-VEZ refuses n > 1, like single-image providers.
    const prompt = String(body.prompt ?? "");
    const n = Math.max(1, Math.min(Number(body.n) || 1, 10));
    record({ images: true, model, n, aspectRatio: body.aspectRatio, promptChars: prompt.length, ...privacy(body.providerOptions) });
    if (prompt.includes("FALHA-ICONE")) return failure(503, "Provider unavailable");
    if (prompt.includes("UM-POR-VEZ") && n > 1) return failure(400, "n must be 1 for this model", "invalid_request_error");
    const images = await mockImages(n);
    return json({ images: images.map((image) => image.toString("base64")), warnings: [], providerMetadata: { gateway: { cost: String(0.001 * n) } } });
  }

  if (path === "/v4/ai/transcription-model") {
    // Speech to text: logs what was asked (never the audio) and answers by the first bytes.
    const audio = Buffer.from(body.audio ?? "", "base64");
    const head = audio.subarray(0, 16).toString("latin1");
    record({
      transcription: true,
      model,
      mediaType: body.mediaType,
      bytes: audio.length,
      locales: body.providerOptions?.azure?.locales ?? null,
      ...privacy(body.providerOptions),
    });
    if (head.startsWith("FAILALL")) return failure(503, "Provider unavailable");
    if (head.startsWith("FAILPRIMARY") && model === "microsoft/mai-transcribe-2") return failure(503, "Provider unavailable");
    if (head.startsWith("SILENCE")) return json({ text: "", durationInSeconds: 1 });
    // LONG plays a recording of 5 minutes: it costs 3 of the hourly transcriptions.
    if (head.startsWith("LONG")) return json({ text: "Texto ditado de teste", durationInSeconds: 300 });
    return json({ text: "Texto ditado de teste", durationInSeconds: 1, providerMetadata: { gateway: { cost: "0" } } });
  }

  if (path === "/v4/ai/decision-model") {
    // Jev stand-in: keyword intent and areas. { jev: "fail" } in the flags file plays Jev down.
    record({ jev: true, model, only: body.providerOptions?.gateway?.only ?? null, ...privacy(body.providerOptions) });
    if (mockFlags().jev === "fail") return failure(503, "Provider returned error");
    const state = (body.stateParts ?? []).find((part) => part.type === "json")?.value ?? {};
    const questions = body.questions ?? {};
    // A complete distribution, as the SDK checks it: the chosen option most likely, the rest sharing what is left.
    const choose = (id, wanted, confidence = 1) => {
      const keys = Object.keys(questions[id].criteria);
      const choice = keys.includes(wanted) ? wanted : keys[0];
      const rest = keys.length > 1 ? (1 - confidence) / (keys.length - 1) : 0;
      return { type: "choice", choice, probabilities: Object.fromEntries(keys.map((key) => [key, key === choice ? (keys.length > 1 ? confidence : 1) : rest])) };
    };
    const answers = {};
    const message = String(state.mensagem ?? "").toLowerCase();
    if (questions.intent) {
      const intent = /falar|atendente|humano/.test(message) ? "humano" : /abre a tela|abrir a tela|vai para|me leva/.test(message) ? "navegar" : /preench/.test(message) ? "tela" : /crie|abra um|criar/.test(message) ? "criar" : "consultar";
      const destino = intent !== "navegar" ? "nenhuma" : /cobran/.test(message) ? "nova_cobranca" : /or[cç]amento/.test(message) ? "novo_orcamento" : /chamado/.test(message) ? "abrir_chamado" : "painel";
      answers.intent = choose("intent", intent);
      if (questions.destino) answers.destino = choose("destino", destino);
    }
    const areaWords = { empresas: /empresa|cliente|cnpj|acesso|membro/, financeiro: /fatura|boleto|cobran|pag|recorr|vencid|deve/, chamados: /chamado|ticket|suporte/, projetos: /projeto|tarefa|quadro/, produtos: /produto|servi[cç]o|cat[aá]logo|vincul/, contratos: /contrato|vig[eê]ncia|modelo/, orcamentos: /or[cç]amento|proposta/, bookmarks: /bookmark|link|pasta/, tela: /preench|tela|formul|clique|bot[aã]o/ };
    for (const [key, pattern] of Object.entries(areaWords)) if (questions[`area_${key}`]) answers[`area_${key}`] = { type: "boolean", probability: pattern.test(message) ? 0.9 : 0.1 };
    // A new ticket read by its text: "parou" or "fora do ar" reads as a stopped system.
    if (questions.tipo) {
      const text = `${state.assunto ?? ""} ${state.descricao ?? ""}`.toLowerCase();
      const down = /parou|fora do ar|n[aã]o abre/.test(text);
      answers.tipo = choose("tipo", down ? "problem" : "question", 0.95);
      if (questions.impacto) answers.impacto = choose("impacto", down ? "down" : "other", 0.95);
    }
    // Anything else asked gets a plain answer, so the SDK never sees a missing one.
    for (const [id, question] of Object.entries(questions))
      if (!answers[id]) answers[id] = question.type === "choice" ? choose(id, Object.keys(question.criteria)[0]) : { type: "boolean", probability: 0.5 };
    return json({ answers, model, usage: { inputTokens: 0, outputTokens: 0 }, warnings: [] });
  }

  // Text: the chat streams; the drafts and the journey answer at once.
  const streaming = headers.get("ai-language-model-streaming") === "true";
  const messages = asMessages(body.prompt);
  const system = textOf(messages.find((m) => m.role === "system")?.content);
  const firstUser = textOf(messages.find((m) => m.role === "user")?.content);
  const usage = (prompt, completion) => ({
    inputTokens: { total: prompt, noCache: prompt, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: completion, text: completion, reasoning: 0 },
  });
  const whole = (text) => json({ content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage: usage(Math.ceil(init.body.length / 4), Math.ceil(text.length / 4)), warnings: [] });
  // The ticket reply draft and the proposal phases: one-shot prompts, no tools.
  const draft = system.startsWith("Você escreve a próxima resposta") ? "reply" : system.startsWith("Você monta o primeiro rascunho") ? "phases" : null;
  if (draft) {
    record({ draft, model, reasoning: body.reasoning ?? null, maxTokens: body.maxOutputTokens, ...privacy(body.providerOptions) });
    if (draft === "reply") return whole("Rascunho de teste: confira o acesso e responda por aqui.");
    return whole(
      JSON.stringify({
        phases: [
          { name: "Descoberta", description: "Entender o fluxo", hoursMin: 8, hoursMax: 12, weeks: 1, tasks: [{ title: "Entrevistas", description: "Com a equipe" }] },
          { name: "Construção", description: "Telas e regras", hoursMin: 40, hoursMax: 60, weeks: 4, tasks: [{ title: "Cadastro", description: "" }] },
        ],
        stack: ["Next.js"],
      }),
    );
  }
  // The project journey's drafts (lib/journeys/journey-ai.ts): one-shot prompts matched by their opening words.
  const journey = journeyAnswer(system, firstUser);
  if (journey) {
    // What was asked is never logged; only which draft, and the privacy options it carried.
    record({ journey: journey.kind, model, maxTokens: body.maxOutputTokens, ...privacy(body.providerOptions) });
    return whole(journey.content);
  }
  const lastUser = textOf([...messages].reverse().find((m) => m.role === "user")?.content);
  record({
    model,
    tools: body.tools?.length,
    messages: messages.length,
    stream: streaming,
    maxTokens: body.maxOutputTokens,
    reasoning: body.reasoning ?? null,
    credits: lastUser.includes("sem-creditos") || undefined,
    ...privacy(body.providerOptions),
    // Only when a suite asks (fake test data): what the model read, to prove what never reaches it.
    prompt: mockFlags().logPrompts ? JSON.stringify(body.prompt) : undefined,
  });
  // Out of credits: the Gateway's 402, which no retry may repeat.
  if (lastUser.includes("sem-creditos")) return failure(402, "Insufficient funds. Add credits to continue.", "insufficient_funds");
  // A slow model on request, to watch the UI while the assistant works.
  const wait = Number(process.env.CONSOLE_TEST_ASSISTANT_DELAY_MS || 0);
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  const payload = decide(messages);
  // Roughly what a real model would bill, so the panel's token counter has numbers.
  const billed = usage(Math.ceil(init.body.length / 4), Math.ceil(JSON.stringify(payload.choices).length / 4));
  if (!streaming) {
    const { message, finish_reason } = payload.choices[0];
    const content = [
      ...(message.content ? [{ type: "text", text: message.content }] : []),
      ...(message.tool_calls ?? []).map((c) => ({ type: "tool-call", toolCallId: c.id, toolName: c.function.name, input: c.function.arguments })),
    ];
    return json({ content, finishReason: { unified: unified(finish_reason), raw: finish_reason }, usage: billed, warnings: [] });
  }
  // "devagar" streams a piece every 60 ms; "corte-no-meio" breaks the stream after three pieces.
  return streamed(payload, billed, model, { gapMs: lastUser.includes("devagar") ? 60 : 0, cut: lastUser.includes("corte-no-meio"), signal: init?.signal });
};

/** The AI SDK's name for a finish reason. */
const unified = (reason) => (reason === "tool_calls" ? "tool-calls" : reason === "length" ? "length" : reason === "stop" ? "stop" : "other");

/** Whether text is a complete JSON value. */
const closes = (text) => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * The same answer as the Gateway streams it (Server-Sent Events of AI SDK
 * stream parts): the text in small pieces, each tool call opened with its id
 * and name and its arguments in pieces, in the order the model wrote them.
 * The finished calls come at the end, in the order their arguments closed (a
 * call with none comes last), so the middleware has to put them back. Cut by
 * the output limit, a call whose arguments never closed is never finished.
 */
function streamed(payload, usage, model, { gapMs, cut, signal }) {
  const { message, finish_reason } = payload.choices[0];
  const events = [{ type: "stream-start", warnings: [] }, { type: "response-metadata", id: "gen-mock", modelId: model, timestamp: new Date().toISOString() }];
  const text = message.content ?? "";
  if (text) {
    events.push({ type: "text-start", id: "t0" });
    for (let i = 0; i < text.length; i += 12) events.push({ type: "text-delta", id: "t0", delta: text.slice(i, i + 12) });
    events.push({ type: "text-end", id: "t0" });
  }
  const calls = message.tool_calls ?? [];
  for (const toolCall of calls) {
    const args = toolCall.function.arguments;
    events.push({ type: "tool-input-start", id: toolCall.id, toolName: toolCall.function.name });
    const half = toolCall.whole ? args.length : Math.ceil(args.length / 2);
    for (const piece of [args.slice(0, half), args.slice(half)]) if (piece) events.push({ type: "tool-input-delta", id: toolCall.id, delta: piece });
    events.push({ type: "tool-input-end", id: toolCall.id });
  }
  const finished = calls.filter((toolCall) => finish_reason !== "length" || closes(toolCall.function.arguments));
  for (const toolCall of [...finished].sort((a, b) => Number(!a.function.arguments) - Number(!b.function.arguments)))
    events.push({ type: "tool-call", toolCallId: toolCall.id, toolName: toolCall.function.name, input: toolCall.function.arguments });
  if (cut) events.splice(3, events.length, { type: "error", error: { message: "Provider disconnected", statusCode: 502 } });
  else events.push({ type: "finish", finishReason: { unified: unified(finish_reason), raw: finish_reason }, usage, providerMetadata: { gateway: { cost: "0" } } });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const event of events) {
        if (signal?.aborted) return controller.error(signal.reason);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (gapMs) await new Promise((resolve) => setTimeout(resolve, gapMs));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
