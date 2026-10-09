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
  const users = messages.filter((m) => m.role === "user").map((m) => m.content.toLowerCase());
  // A short "sim" answers the request before it: act on that one.
  const user = /^(sim|confirmo|pode|ok)\b/.test(users.at(-1) ?? "") && users.length > 1 ? users.at(-2) : (users.at(-1) ?? "");
  const tools = messages.filter((m) => m.role === "tool").map((m) => JSON.parse(m.content));
  const calls = messages.flatMap((m) => m.tool_calls ?? []).map((c) => c.function.name);
  const summarize = () =>
    tools
      .map((t) => (Array.isArray(t) ? t : [t]))
      .flat()
      .slice(0, 5)
      .map((row) => {
        if (row.clientes) return `- ${row.clientes.map((c) => `${c.nome}: ${c.faturado} faturado, ${c.emAberto} em aberto`).join("; ")} (total ${row.totais.faturado})`;
        if (row.faturaId) return `- ${row.descricao}: **${row.valor}**, vence ${row.vencimento}, ${row.situacao}${row.linkPagamento ? ` · [pagar](${row.linkPagamento})` : ""}${row.boletoPdf ? ` · [boleto PDF](${row.boletoPdf})` : ""}`;
        if (row.chamadoId) return `- [${row.assunto}](${row.link}) · ${row.situacao}`;
        if (row.engagementId) return `- [${row.nome}](${row.link}) · ${row.tipo} · ${row.situacao}`;
        if (row.nome && row.cnpj) return `- ${row.nome} (${row.cnpj})`;
        if (row.erro) return `- Erro: ${row.erro}`;
        if (row.rascunho && row.link) return `- Orçamento em rascunho: [abrir](${row.link}) · ${row.esforco} · ${row.valorTotal}`;
        if (row.aberto && row.link) return `- Chamado aberto: [${row.assunto ?? "ver"}](${row.link})`;
        if (row.atualizado && row.valorTotal) return `- Orçamento atualizado: ${row.valorTotal} · [abrir](${row.link})`;
        if (row.atualizadas) return `- ${row.atualizadas} tarefas atualizadas · [quadro](${row.link})`;
        if (row.comentadas) return `- Comentário publicado em ${row.comentadas} tarefa(s) · [quadro](${row.link})`;
        return `- ${JSON.stringify(row).slice(0, 200)}`;
      })
      .join("\n");
  // Second round onwards: chain or finish.
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
    if (user.includes("chamado")) return reply(null, [call("abrir_chamado", { companyId: first.companyId, assunto: "Teste do assistente", descricao: "Chamado aberto pelo assistente durante o QA." })]);
    if (user.includes("resumo")) return reply(null, [call("resumo_da_empresa", { companyId: first.companyId })]);
    // The production failure: optional fields sent as "" / null instead of omitted.
    if ((user.includes("orcamento") || user.includes("orçamento")) && user.includes("sem validade"))
      return reply(null, [call("criar_orcamento", { companyId: first.companyId, copiarDeOrcamentoId: "", titulo: "Correções e melhorias", resumo: "PRs 16 a 23.", taxaHoraReais: 150, entradaPercentual: 0, validoAte: null, stack: null, fases: [{ nome: "Correções e Melhorias", descricao: "", horasMin: 54, horasMax: 54, tarefas: [{ titulo: "PR 16" }, { titulo: "PR 17" }] }], observacoes: null })]);
    if (user.includes("orcamento") || user.includes("orçamento"))
      return reply(null, [call("criar_orcamento", { companyId: first.companyId, titulo: "Portal do cliente", resumo: "Área logada para acompanhar pedidos.", taxaHoraReais: 120, entradaPercentual: 40, validoAte: "2026-10-31", stack: ["Next.js", "PostgreSQL"], fases: [{ nome: "Descoberta", descricao: "Levantamento e protótipo.", horasMin: 6, horasMax: 8, tarefas: [{ titulo: "Entrevistas", descricao: "Duas sessões com o cliente." }] }, { nome: "Construção", horasMin: 20, horasMax: 26, tarefas: [{ titulo: "Login e cadastro" }, { titulo: "Lista de pedidos" }] }] })]);
  }
  if (tools.length) return reply(`Aqui está o que encontrei:\n\n${summarize()}`);
  // On a quote draft, "preencha as tarefas" updates the quote itself (not the screen).
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const openQuote = /Registro aberto nesta tela: orçamento ([0-9a-f-]{36})/.exec(system)?.[1];
  if (openQuote && /tarefa|fase/.test(user) && !calls.includes("atualizar_orcamento"))
    return reply(null, [call("atualizar_orcamento", { orcamentoId: openQuote, entradaPercentual: 0, validoAte: "", fases: [{ nome: "Correções e Melhorias", descricao: "Product Requests II", horasMin: 54, horasMax: 54, tarefas: [{ titulo: "PR 16 — Ajuste no cadastro" }, { titulo: "PR 17 — Filtro de relatórios" }, { titulo: "PR 18 — Exportação CSV" }] }] })]);
  // First round: pick a tool from the wording.
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
  return reply(`Recebi: "${user}". Sou o mock do OpenRouter e só sei falar de boletos, chamados, projetos e resumos.`);
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

globalThis.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : input.url;
  // The model catalog comes from a saved copy, so the settings page works offline too.
  if (url.includes("openrouter.ai/api/v1/models")) {
    const file = process.env.CONSOLE_TEST_MODELS_FILE;
    if (!file || !fs.existsSync(file)) return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(fs.readFileSync(file), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (
    !url.includes("openrouter.ai/api/v1/chat/completions") &&
    !url.includes("openrouter.ai/api/v1/systemone") &&
    !url.includes("openrouter.ai/api/v1/audio/transcriptions")
  )
    return originalFetch.apply(this, arguments);
  // Live mode: let the real OpenRouter answer, bypassing the OTP harness's outbound block.
  if (process.env.CONSOLE_TEST_OPENROUTER_LIVE === "1" && globalThis.__nativeFetch) {
    if (log) fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), live: true, url, model: JSON.parse(init.body).model }) + "\n");
    return globalThis.__nativeFetch.apply(this, arguments);
  }
  if (url.includes("/audio/transcriptions")) {
    // Speech to text: logs what was asked (never the audio) and answers by the first bytes.
    const req = JSON.parse(init.body);
    const audio = Buffer.from(req.input_audio?.data ?? "", "base64");
    const head = audio.subarray(0, 16).toString("latin1");
    if (log)
      fs.appendFileSync(
        log,
        JSON.stringify({ at: new Date().toISOString(), transcription: true, model: req.model, format: req.input_audio?.format, bytes: audio.length, zdr: req.provider?.zdr, language: req.language, data: undefined }) + "\n",
      );
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
    if (head.startsWith("FAILALL")) return json({ error: { message: "Provider unavailable" } }, 503);
    if (head.startsWith("FAILPRIMARY") && req.model === "microsoft/mai-transcribe-2") return json({ error: { message: "Provider unavailable" } }, 503);
    if (head.startsWith("SILENCE")) return json({ text: "", usage: { seconds: 1, cost: 0 } });
    // LONG plays a recording of 5 minutes: it costs 3 of the hourly transcriptions.
    if (head.startsWith("LONG")) return json({ text: "Texto ditado de teste", usage: { seconds: 300, cost: 0 } });
    return json({ text: "Texto ditado de teste", usage: { seconds: 1, cost: 0 } });
  }
  if (url.includes("/systemone")) {
    // Jev stand-in: keyword intent, keyword approval.
    const req = JSON.parse(init.body);
    const answers = {};
    const message = String(req.state?.mensagem ?? "").toLowerCase();
    if (req.questions.intent) {
      const intent = /falar|atendente|humano/.test(message) ? "humano" : /abre a tela|abrir a tela|vai para|me leva/.test(message) ? "navegar" : /preench/.test(message) ? "tela" : /crie|abra um|criar/.test(message) ? "criar" : "consultar";
      const destino = intent !== "navegar" ? "nenhuma" : /cobran/.test(message) ? "nova_cobranca" : /or[cç]amento/.test(message) ? "novo_orcamento" : /chamado/.test(message) ? "abrir_chamado" : "painel";
      answers.intent = { type: "choice", choice: intent, probabilities: { [intent]: 1 }, confidence: 1 };
      answers.destino = { type: "choice", choice: destino, probabilities: { [destino]: 1 }, confidence: 1 };
    }
    const areaWords = { empresas: /empresa|cliente|cnpj|acesso|membro/, financeiro: /fatura|boleto|cobran|pag|recorr|vencid|deve/, chamados: /chamado|ticket|suporte/, projetos: /projeto|tarefa|quadro/, produtos: /produto|servi[cç]o|cat[aá]logo|vincul/, contratos: /contrato|vig[eê]ncia|modelo/, orcamentos: /or[cç]amento|proposta/, bookmarks: /bookmark|link|pasta/, tela: /preench|tela|formul/ };
    for (const [key, pattern] of Object.entries(areaWords)) if (req.questions[`area_${key}`]) answers[`area_${key}`] = { type: "noul", noul: pattern.test(message) ? 0.9 : 0.1 };
    // A new ticket read by its text: "parou" or "fora do ar" reads as a stopped system.
    if (req.questions.tipo) {
      const text = `${req.state?.assunto ?? ""} ${req.state?.descricao ?? ""}`.toLowerCase();
      const down = /parou|fora do ar|n[aã]o abre/.test(text);
      answers.tipo = { type: "choice", choice: down ? "problem" : "question", probabilities: {}, confidence: 0.95 };
      answers.impacto = { type: "choice", choice: down ? "down" : "other", probabilities: {}, confidence: 0.95 };
    }
    if (req.questions.aprovado) {
      const recent = req.state?.conversa_recente ?? [];
      const person = [...recent].reverse().find((m) => m.de === "pessoa")?.texto?.toLowerCase() ?? "";
      // CONSOLE_TEST_JEV_REJECT=1 plays a strict Jev that never sees approval.
      const approved = process.env.CONSOLE_TEST_JEV_REJECT !== "1" && /\b(sim|aprovo|pode|fa[cç]a|crie|abra|confirmo|preencha|envie|manda|vincul\w*)\b/.test(person);
      answers.aprovado = { type: "noul", noul: approved ? 0.95 : 0.15 };
    }
    return new Response(JSON.stringify({ model: "typesafe/jev-mock", answers, usage: { cost: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const body = JSON.parse(init.body);
  // The ticket reply draft and the proposal phases: one-shot prompts, no tools.
  const system = String(body.messages?.[0]?.content ?? "");
  if (system.startsWith("Você escreve a próxima resposta"))
    return new Response(JSON.stringify(reply("Rascunho de teste: confira o acesso e responda por aqui.")), { status: 200, headers: { "Content-Type": "application/json" } });
  if (system.startsWith("Você monta o primeiro rascunho"))
    return new Response(
      JSON.stringify(
        reply(
          JSON.stringify({
            phases: [
              { name: "Descoberta", description: "Entender o fluxo", hoursMin: 8, hoursMax: 12, weeks: 1, tasks: [{ title: "Entrevistas", description: "Com a equipe" }] },
              { name: "Construção", description: "Telas e regras", hoursMin: 40, hoursMax: 60, weeks: 4, tasks: [{ title: "Cadastro", description: "" }] },
            ],
            stack: ["Next.js"],
          }),
        ),
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  // The project journey's drafts (lib/journeys/journey-ai.ts): one-shot prompts matched by their opening words.
  const journey = journeyAnswer(system, String(body.messages?.[1]?.content ?? ""));
  if (journey) {
    // What was asked is never logged; only which draft, and that the call refused data collection.
    if (log) fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), journey: journey.kind, model: body.model, dataCollection: body.provider?.data_collection ?? null, maxTokens: body.max_tokens }) + "\n");
    return new Response(JSON.stringify(reply(journey.content)), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (log) fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), model: body.model, tools: body.tools?.length, messages: body.messages.length }) + "\n");
  // A slow model on request, to watch the UI while the assistant works.
  const wait = Number(process.env.CONSOLE_TEST_ASSISTANT_DELAY_MS || 0);
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  const payload = decide(body.messages);
  // Roughly what a real model would bill, so the panel's token counter has numbers.
  payload.usage = { prompt_tokens: Math.ceil(init.body.length / 4), completion_tokens: Math.ceil(JSON.stringify(payload.choices).length / 4) };
  return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
};
