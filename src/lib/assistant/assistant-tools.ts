import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { allowedIds, canAccess } from "../access/access";
import {
  assistantDocuments,
  companies,
  contracts,
  engagements,
  invoices,
  messages,
  quotes,
  subscriptions,
  taskAssignees,
  taskComments,
  tasks,
  tickets,
  user,
} from "@/db/schema";
import { createEngagement, createTicket, replyTicket } from "../actions";
import { createTask, moveTask } from "../projects/task-actions";
import { formatDocument } from "../companies/company-input";
import { contractStatusLabels } from "../contracts/contract-table";
import { currency, engagementLabels, priorityLabels, ticketLabels } from "../format";
import { hasPermission, type Area } from "../access/permissions";
import { createQuote } from "../quotes/quote-actions";
import { DEFAULT_QUOTE_NOTES, hoursLabel, quoteNumberLabel, quoteStatusLabels, quoteTotals, type QuoteContent } from "../quotes/quote-model";
import { TASK_PRIORITIES, TASK_STATUSES, taskPriorityLabels, taskStatusLabels } from "../projects/task-model";
import { OPEN_TICKET_STATUSES } from "../tickets/ticket-status";

/* ---------- plumbing (shared with assistant-tools-extra) ---------- */
import { fold, id, limit, resolvePeople, scopeOf, submit, tool, ToolError, within, type AnyTool, type ToolArea, type ToolContext, type ToolOutcome } from "./assistant-tools-kit";
export { ToolError } from "./assistant-tools-kit";
export type { AnyTool, ClientAction, ToolArea, ToolContext, ToolOutcome } from "./assistant-tools-kit";
export { toolAreas } from "./assistant-tools-kit";
import type { Actor } from "../access/access";
import { extraTools } from "./assistant-tools-extra";

const invoiceSituation = (status: string, dueDate: string, today: string) =>
  status === "paid"
    ? "paga"
    : status === "cancelled"
      ? "cancelada"
      : status === "draft"
        ? "rascunho (ainda não emitida)"
        : dueDate < today
          ? "vencida"
          : "em aberto";

/* ---------- the catalog ---------- */

const listCompanies = tool({
  name: "listar_empresas",
  description:
    "Lista as empresas que a pessoa pode ver, com id e CNPJ. Use para descobrir o companyId antes de outras ferramentas quando a pessoa tem mais de uma empresa. A equipe da Anuntech pode buscar pelo nome.",
  input: z.object({ busca: z.string().trim().max(80).optional(), limite: limit(20) }),
  run: async ({ actor }, { busca, limite }) => {
    const rows = actor.admin
      ? await db
          .select({ id: companies.id, name: companies.name, document: companies.document, archived: companies.archived })
          .from(companies)
          .where(busca ? or(ilike(companies.name, `%${busca}%`), ilike(companies.document, `%${busca.replace(/\D/g, "") || busca}%`)) : undefined)
          .orderBy(asc(companies.archived), asc(companies.name))
          .limit(limite)
      : actor.grants
          .map((g) => ({ id: g.company.id, name: g.company.name, document: g.company.document, archived: g.company.archived, role: g.role }))
          .filter((c) => !busca || fold(c.name).includes(fold(busca)))
          .slice(0, limite);
    return {
      result: rows.map((c) => ({ companyId: c.id, nome: c.name, cnpj: formatDocument(c.document), arquivada: c.archived || undefined })),
      summary: "Consultei as empresas",
    };
  },
});

const companyOverview = tool({
  name: "resumo_da_empresa",
  area: "empresas",
  description: "Um retrato da empresa: chamados abertos, faturas em aberto e vencidas, projetos, produtos, contratos e orçamentos.",
  input: z.object({ companyId: id }),
  run: async ({ actor, today }, { companyId }) => {
    if (!canAccess(actor, companyId, "overview")) throw new ToolError("Você não tem acesso a essa empresa.");
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) throw new ToolError("Empresa não encontrada.");
    const finance = actor.admin || hasPermission(actor.grants.find((g) => g.company.id === companyId)!.role, "finance");
    const [openTickets, openInvoices, works, signed, waitingQuotes] = await Promise.all([
      db.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.companyId, companyId), inArray(tickets.status, [...OPEN_TICKET_STATUSES]))),
      finance
        ? db
            .select({ amount: invoices.amountCents, dueDate: invoices.dueDate })
            .from(invoices)
            .where(and(eq(invoices.companyId, companyId), eq(invoices.status, "issued")))
        : [],
      db.select({ kind: engagements.kind, status: engagements.status }).from(engagements).where(eq(engagements.companyId, companyId)),
      finance ? db.select({ id: contracts.id }).from(contracts).where(and(eq(contracts.companyId, companyId), eq(contracts.status, "signed"))) : [],
      finance ? db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.companyId, companyId), eq(quotes.status, "sent"))) : [],
    ]);
    const overdue = openInvoices.filter((i) => i.dueDate < today);
    return {
      result: {
        companyId,
        nome: company.name,
        cnpj: formatDocument(company.document),
        chamadosAbertos: openTickets.length,
        ...(finance
          ? {
              faturasEmAberto: openInvoices.length,
              totalEmAberto: currency(openInvoices.reduce((sum, i) => sum + i.amount, 0)),
              faturasVencidas: overdue.length,
              totalVencido: currency(overdue.reduce((sum, i) => sum + i.amount, 0)),
              contratosAssinados: signed.length,
              orcamentosAguardandoResposta: waitingQuotes.length,
            }
          : { financeiro: "sem acesso" }),
        projetosAtivos: works.filter((w) => w.kind === "project" && w.status === "active").length,
        produtosEServicos: works.filter((w) => w.kind !== "project").length,
      },
      summary: `Consultei o resumo de ${company.name}`,
    };
  },
});

const listInvoices = tool({
  name: "listar_faturas",
  description:
    "Faturas (cobranças), com valor, vencimento, situação, link de pagamento e PDF do boleto quando existe. Sem companyId, traz de todas as empresas que a pessoa vê em uma só chamada. Para 'o último boleto' use situacao 'abertas' e limite 1; se não houver, use 'todas'. As cobranças são criadas pela Anuntech; você não cria nem altera faturas.",
  input: z.object({
    companyId: id.optional(),
    situacao: z.enum(["abertas", "vencidas", "pagas", "todas"]).default("abertas"),
    limite: limit(5),
  }),
  run: async ({ actor, today }, { companyId, situacao, limite }) => {
    const ids = scopeOf(actor, "finance", companyId);
    const rows = await db
      .select({
        id: invoices.id,
        companyId: invoices.companyId,
        company: companies.name,
        description: invoices.description,
        amountCents: invoices.amountCents,
        dueDate: invoices.dueDate,
        bankDueDate: invoices.bankDueDate,
        status: invoices.status,
        publicId: invoices.publicId,
        publicEnabled: invoices.publicEnabled,
        boletoLine: invoices.boletoLine,
        boletoUrl: invoices.boletoUrl,
        pix: invoices.pixCopyPaste,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      .where(
        and(
          within(invoices.companyId, ids),
          actor.admin ? undefined : ne(invoices.status, "draft"),
          situacao === "pagas" ? eq(invoices.status, "paid") : situacao === "todas" ? undefined : eq(invoices.status, "issued"),
        ),
      )
      .orderBy(situacao === "abertas" || situacao === "vencidas" ? asc(invoices.dueDate) : desc(invoices.dueDate))
      .limit(situacao === "vencidas" ? 50 : limite);
    const list = (situacao === "vencidas" ? rows.filter((r) => r.dueDate < today).slice(0, limite) : rows).map((r) => {
      const payable = r.status === "issued" || r.status === "paid";
      return {
        faturaId: r.id,
        empresa: r.company,
        descricao: r.description,
        valor: currency(r.amountCents),
        vencimento: r.dueDate,
        pagarAte: r.bankDueDate ?? r.dueDate,
        situacao: invoiceSituation(r.status, r.dueDate, today),
        linkPagamento: payable && r.publicEnabled && r.publicId ? `/pagar/${r.publicId}` : null,
        boletoPdf: r.status === "issued" && (r.boletoLine || r.boletoUrl) ? `/api/boletos/${r.id}` : null,
        pixDisponivel: !!r.pix,
        detalhe: `/financeiro/${r.id}`,
      };
    });
    return { result: list, summary: "Consultei as faturas" };
  },
});

/** A civil date N months before another, ISO; clamps the day to the target month. */
const monthsBefore = (iso: string, months: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
};

const financeSummary = tool({
  name: "resumo_financeiro",
  area: "financeiro",
  description:
    "Totais por cliente (empresa) em um período: faturado, pago, em aberto, vencido, quantidade de faturas e recorrência mensal ativa. É a ferramenta certa para 'maior cliente', 'quanto faturamos', 'quem deve mais', rankings e comparações. Nunca some listas de faturas para chegar a totais. Conta só faturas emitidas ou pagas (rascunhos e canceladas ficam de fora), pela data de vencimento.",
  input: z.object({
    companyId: id.optional(),
    periodo: z.enum(["ultimos_12_meses", "ano_atual", "mes_atual", "tudo"]).default("ultimos_12_meses"),
    ordenarPor: z.enum(["faturado", "em_aberto", "vencido", "recorrencia"]).default("faturado"),
    limite: limit(10),
  }),
  run: async ({ actor, today }, { companyId, periodo, ordenarPor, limite }) => {
    const ids = scopeOf(actor, "finance", companyId);
    const from =
      periodo === "tudo"
        ? null
        : periodo === "ano_atual"
          ? `${today.slice(0, 4)}-01-01`
          : periodo === "mes_atual"
            ? `${today.slice(0, 7)}-01`
            : monthsBefore(today, 12);
    const [rows, recurring] = await Promise.all([
      db
        .select({ companyId: invoices.companyId, company: companies.name, status: invoices.status, amount: invoices.amountCents, dueDate: invoices.dueDate })
        .from(invoices)
        .innerJoin(companies, eq(companies.id, invoices.companyId))
        .where(and(within(invoices.companyId, ids), inArray(invoices.status, ["issued", "paid"]), from ? gte(invoices.dueDate, from) : undefined)),
      db
        .select({ companyId: subscriptions.companyId, company: companies.name, amount: subscriptions.amountCents, interval: subscriptions.interval })
        .from(subscriptions)
        .innerJoin(companies, eq(companies.id, subscriptions.companyId))
        .where(and(within(subscriptions.companyId, ids), eq(subscriptions.status, "active"))),
    ]);
    type Line = { companyId: string; nome: string; faturado: number; pago: number; emAberto: number; vencido: number; faturas: number; recorrenciaMensal: number };
    const byCompany = new Map<string, Line>();
    const line = (cid: string, name: string) => {
      const found = byCompany.get(cid);
      if (found) return found;
      const fresh: Line = { companyId: cid, nome: name, faturado: 0, pago: 0, emAberto: 0, vencido: 0, faturas: 0, recorrenciaMensal: 0 };
      byCompany.set(cid, fresh);
      return fresh;
    };
    for (const r of rows) {
      const l = line(r.companyId, r.company);
      l.faturado += r.amount;
      l.faturas += 1;
      if (r.status === "paid") l.pago += r.amount;
      else {
        l.emAberto += r.amount;
        if (r.dueDate < today) l.vencido += r.amount;
      }
    }
    for (const r of recurring) line(r.companyId, r.company).recorrenciaMensal += r.interval === "yearly" ? Math.round(r.amount / 12) : r.amount;
    const key = { faturado: "faturado", em_aberto: "emAberto", vencido: "vencido", recorrencia: "recorrenciaMensal" }[ordenarPor] as keyof Line;
    const lines = [...byCompany.values()].sort((a, b) => (b[key] as number) - (a[key] as number));
    const sum = (field: keyof Line) => lines.reduce((n, l) => n + (l[field] as number), 0);
    const money = (l: Line) => ({
      companyId: l.companyId,
      nome: l.nome,
      faturado: currency(l.faturado),
      pago: currency(l.pago),
      emAberto: currency(l.emAberto),
      vencido: currency(l.vencido),
      faturas: l.faturas,
      recorrenciaMensal: currency(l.recorrenciaMensal),
      linkFaturas: `/financeiro?company=${l.companyId}`,
    });
    return {
      result: {
        periodo: { de: from ?? "início", ate: today, criterio: "data de vencimento; só faturas emitidas ou pagas" },
        ordenadoPor: ordenarPor,
        clientes: lines.slice(0, limite).map(money),
        totais: { faturado: currency(sum("faturado")), pago: currency(sum("pago")), emAberto: currency(sum("emAberto")), vencido: currency(sum("vencido")), recorrenciaMensal: currency(sum("recorrenciaMensal")), clientes: lines.length },
      },
      summary: "Consultei o resumo financeiro",
    };
  },
});

const listTickets = tool({
  name: "listar_chamados",
  description: "Chamados (tickets de suporte), com situação, prioridade e link. Sem companyId, traz de todas as empresas que a pessoa vê.",
  input: z.object({ companyId: id.optional(), situacao: z.enum(["abertos", "todos"]).default("abertos"), limite: limit(10) }),
  run: async ({ actor }, { companyId, situacao, limite }) => {
    const ids = scopeOf(actor, "support", companyId);
    const rows = await db
      .select({ id: tickets.id, subject: tickets.subject, status: tickets.status, priority: tickets.priority, company: companies.name, updatedAt: tickets.updatedAt })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .where(and(within(tickets.companyId, ids), situacao === "abertos" ? inArray(tickets.status, [...OPEN_TICKET_STATUSES]) : undefined))
      .orderBy(desc(tickets.updatedAt))
      .limit(limite);
    return {
      result: rows.map((t) => ({
        chamadoId: t.id,
        assunto: t.subject,
        empresa: t.company,
        situacao: ticketLabels[t.status] ?? t.status,
        prioridade: priorityLabels[t.priority] ?? t.priority,
        atualizadoEm: t.updatedAt.toISOString(),
        link: `/chamados/${t.id}`,
      })),
      summary: "Consultei os chamados",
    };
  },
});

const readTicket = tool({
  name: "ler_chamado",
  area: "chamados",
  description: "As últimas mensagens de um chamado, para saber onde ele parou.",
  input: z.object({ chamadoId: id }),
  run: async ({ actor }, { chamadoId }) => {
    const [t] = await db.select().from(tickets).where(eq(tickets.id, chamadoId));
    if (!t || !canAccess(actor, t.companyId, "support")) throw new ToolError("Chamado não encontrado.");
    const thread = await db
      .select({ body: messages.body, author: user.name, email: user.email, at: messages.createdAt })
      .from(messages)
      .leftJoin(user, eq(user.id, messages.authorId))
      .where(eq(messages.ticketId, t.id))
      .orderBy(desc(messages.createdAt))
      .limit(12);
    return {
      result: {
        chamadoId: t.id,
        assunto: t.subject,
        situacao: ticketLabels[t.status] ?? t.status,
        prioridade: priorityLabels[t.priority] ?? t.priority,
        link: `/chamados/${t.id}`,
        mensagens: thread.reverse().map((m) => ({ de: m.author || m.email || "—", em: m.at.toISOString(), texto: m.body.slice(0, 1500) })),
      },
      summary: `Li o chamado "${t.subject}"`,
    };
  },
});

const openTicket = tool({
  name: "abrir_chamado",
  area: "chamados",
  description:
    "Abre um chamado de suporte para a empresa com assunto e descrição. Confirme o assunto e a descrição com a pessoa antes de chamar, a não ser que o pedido já esteja completo e claro.",
  input: z.object({
    companyId: id,
    assunto: z.string().trim().min(3).max(160),
    descricao: z.string().trim().min(3).max(10000),
    prioridade: z.enum(["normal", "high"]).default("normal"),
  }),
  write: true,
  run: async ({ actor }, input) => {
    if (!canAccess(actor, input.companyId, "support")) throw new ToolError("Você não tem acesso de suporte nessa empresa.");
    const state = await submit(createTicket, {
      companyId: input.companyId,
      subject: input.assunto,
      body: input.descricao,
      priority: input.prioridade,
    });
    let href = state.href ?? null;
    if (!href) {
      const [row] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(eq(tickets.companyId, input.companyId), eq(tickets.authorId, actor.user.id), eq(tickets.subject, input.assunto)))
        .orderBy(desc(tickets.createdAt))
        .limit(1);
      href = row ? `/chamados/${row.id}` : "/chamados";
    }
    return { result: { aberto: true, link: href, assunto: input.assunto }, summary: `Abri o chamado "${input.assunto}"` };
  },
});

const answerTicket = tool({
  name: "responder_chamado",
  area: "chamados",
  description: "Envia uma mensagem em um chamado existente, em nome da pessoa. Confirme o texto antes de enviar.",
  input: z.object({ chamadoId: id, mensagem: z.string().trim().min(1).max(10000) }),
  write: true,
  run: async ({ actor }, { chamadoId, mensagem }) => {
    const [t] = await db.select({ companyId: tickets.companyId, subject: tickets.subject }).from(tickets).where(eq(tickets.id, chamadoId));
    if (!t || !canAccess(actor, t.companyId, "support")) throw new ToolError("Chamado não encontrado.");
    await submit(replyTicket, { ticketId: chamadoId, body: mensagem });
    return { result: { enviado: true, link: `/chamados/${chamadoId}` }, summary: `Respondi o chamado "${t.subject}"` };
  },
});

const listWorks = tool({
  name: "listar_projetos_e_produtos",
  description: "Projetos, produtos e serviços de uma empresa (engagements), com situação e link. Use o engagementId para ver ou criar tarefas.",
  input: z.object({ companyId: id.optional(), tipo: z.enum(["project", "product", "service", "all"]).default("all") }),
  run: async ({ actor }, { companyId, tipo }) => {
    const ids = scopeOf(actor, "overview", companyId);
    const rows = await db
      .select({ id: engagements.id, name: engagements.name, kind: engagements.kind, status: engagements.status, description: engagements.description, url: engagements.url, company: companies.name })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .where(and(within(engagements.companyId, ids), tipo === "all" ? undefined : eq(engagements.kind, tipo)))
      .orderBy(asc(engagements.name))
      .limit(60);
    return {
      result: rows.map((w) => ({
        engagementId: w.id,
        nome: w.name,
        empresa: w.company,
        tipo: engagementLabels[w.kind] ?? w.kind,
        situacao: engagementLabels[w.status] ?? w.status,
        descricao: w.description?.slice(0, 300) ?? null,
        link: w.kind === "project" ? `/projetos/${w.id}` : w.kind === "service" ? `/produtos/${w.id}` : (w.url ?? "/produtos"),
      })),
      summary: "Consultei projetos e produtos",
    };
  },
});

async function projectAccess(actor: Actor, engagementId: string) {
  const [work] = await db.select({ id: engagements.id, name: engagements.name, companyId: engagements.companyId, kind: engagements.kind }).from(engagements).where(eq(engagements.id, engagementId));
  if (!work || !canAccess(actor, work.companyId, "overview")) throw new ToolError("Projeto não encontrado.");
  return work;
}

const listTasks = tool({
  name: "listar_tarefas",
  area: "projetos",
  description: "As tarefas do quadro de um projeto, com situação, prioridade, prazo, responsáveis e quantos comentários cada uma tem.",
  input: z.object({ engagementId: id, situacao: z.enum([...TASK_STATUSES, "all"]).default("all") }),
  run: async ({ actor }, { engagementId, situacao }) => {
    const work = await projectAccess(actor, engagementId);
    const rows = await db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority, dueDate: tasks.dueDate, description: tasks.description })
      .from(tasks)
      .where(and(eq(tasks.engagementId, engagementId), situacao === "all" ? undefined : eq(tasks.status, situacao)))
      .orderBy(asc(tasks.status), asc(tasks.position))
      .limit(100);
    const [assigned, said] = rows.length
      ? await Promise.all([
          db
            .select({ taskId: taskAssignees.taskId, name: user.name, email: user.email })
            .from(taskAssignees)
            .innerJoin(user, eq(user.id, taskAssignees.userId))
            .where(inArray(taskAssignees.taskId, rows.map((t) => t.id))),
          db
            .select({ taskId: taskComments.taskId, n: sql<number>`count(*)::int` })
            .from(taskComments)
            .where(inArray(taskComments.taskId, rows.map((t) => t.id)))
            .groupBy(taskComments.taskId),
        ])
      : [[], []];
    return {
      result: {
        projeto: work.name,
        link: `/projetos/${work.id}`,
        tarefas: rows.map((t) => ({
          tarefaId: t.id,
          titulo: t.title,
          situacao: taskStatusLabels[t.status as keyof typeof taskStatusLabels] ?? t.status,
          prioridade: taskPriorityLabels[t.priority],
          prazo: t.dueDate,
          responsaveis: assigned.filter((a) => a.taskId === t.id).map((a) => a.name || a.email),
          comentarios: said.find((c) => c.taskId === t.id)?.n ?? 0,
          descricao: t.description?.slice(0, 200) ?? null,
        })),
      },
      summary: `Consultei as tarefas de ${work.name}`,
    };
  },
});

const addTask = tool({
  name: "criar_tarefa",
  area: "projetos",
  description:
    "Cria uma tarefa no quadro de um projeto. Para montar um projeto inteiro, chame uma vez por tarefa, na ordem em que devem acontecer. Confirme a lista com a pessoa antes de criar muitas. responsaveis: ids de pessoas (ler_projeto lista quem pode) ou 'eu' para a própria pessoa.",
  input: z.object({
    engagementId: id,
    titulo: z.string().trim().min(1).max(160),
    descricao: z.string().trim().max(5000).default(""),
    situacao: z.enum(TASK_STATUSES).default("todo"),
    prioridade: z.enum(TASK_PRIORITIES).default("normal"),
    prazo: z.union([z.iso.date(), z.literal("")]).default(""),
    estimativaHoras: z.number().min(0).max(1000).optional(),
    responsaveis: z.array(z.string().trim().min(1).max(128)).max(10).optional(),
  }),
  write: true,
  run: async ({ actor }, input) => {
    const work = await projectAccess(actor, input.engagementId);
    await submit(
      createTask,
      {
        engagementId: input.engagementId,
        title: input.titulo,
        description: input.descricao,
        status: input.situacao,
        priority: input.prioridade,
        dueDate: input.prazo,
        estimate: input.estimativaHoras ? String(input.estimativaHoras).replace(".", ",") : "",
      },
      { assigneeIds: resolvePeople(actor, input.responsaveis) ?? [] },
    );
    return { result: { criada: true, projeto: work.name, link: `/projetos/${work.id}` }, summary: `Criei a tarefa "${input.titulo}" em ${work.name}` };
  },
});

const moveTaskTool = tool({
  name: "mover_tarefa",
  area: "projetos",
  description: "Muda a situação de uma tarefa (backlog, todo, in_progress, review, done).",
  input: z.object({ tarefaId: id, situacao: z.enum(TASK_STATUSES) }),
  write: true,
  run: async (_ctx, { tarefaId, situacao }) => {
    const state = await moveTask({ id: tarefaId, status: situacao, afterId: null });
    if (state.error) throw new ToolError(state.error);
    return { result: { movida: true, situacao: taskStatusLabels[situacao] }, summary: `Movi a tarefa para ${taskStatusLabels[situacao]}` };
  },
});

const addProject = tool({
  name: "criar_projeto",
  area: "projetos",
  description: "Cria um projeto para uma empresa (só a equipe da Anuntech). Depois, use criar_tarefa para montar o quadro.",
  input: z.object({ companyId: id, nome: z.string().trim().min(1).max(160), descricao: z.string().trim().max(3000).default("") }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const state = await submit(createEngagement, { companyId: input.companyId, name: input.nome, kind: "project", description: input.descricao });
    const href = state.href ?? "/projetos";
    const engagementId = href.startsWith("/projetos/") ? href.slice("/projetos/".length) : null;
    return { result: { criado: true, engagementId, link: href }, summary: `Criei o projeto "${input.nome}"` };
  },
});

const listContracts = tool({
  name: "listar_contratos",
  description: "Contratos de uma empresa, com situação, vigência e link.",
  input: z.object({ companyId: id.optional() }),
  run: async ({ actor }, { companyId }) => {
    const ids = scopeOf(actor, "finance", companyId);
    const rows = await db
      .select({ id: contracts.id, title: contracts.title, status: contracts.status, startsAt: contracts.startsAt, endsAt: contracts.endsAt, kind: contracts.kind, company: companies.name })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .where(and(within(contracts.companyId, ids), actor.admin ? undefined : inArray(contracts.status, ["sent", "signed"])))
      .orderBy(desc(contracts.updatedAt))
      .limit(40);
    return {
      result: rows.map((c) => ({
        contratoId: c.id,
        titulo: c.title,
        empresa: c.company,
        tipo: c.kind === "amendment" ? "aditivo" : "contrato",
        situacao: contractStatusLabels[c.status],
        inicio: c.startsAt,
        fim: c.endsAt,
        link: `/contratos/${c.id}`,
      })),
      summary: "Consultei os contratos",
    };
  },
});

const listQuotes = tool({
  name: "listar_orcamentos",
  description: "Orçamentos (propostas) de uma empresa, com valor, situação, validade e link.",
  input: z.object({ companyId: id.optional() }),
  run: async ({ actor }, { companyId }) => {
    const ids = scopeOf(actor, "finance", companyId);
    const rows = await db
      .select({ id: quotes.id, year: quotes.year, seq: quotes.seq, title: quotes.title, status: quotes.status, validUntil: quotes.validUntil, content: quotes.content, publication: quotes.publication, company: companies.name })
      .from(quotes)
      .innerJoin(companies, eq(companies.id, quotes.companyId))
      .where(and(within(quotes.companyId, ids), actor.admin ? undefined : inArray(quotes.status, ["sent", "accepted", "declined"])))
      .orderBy(desc(quotes.updatedAt))
      .limit(40);
    return {
      result: rows.map((q) => ({
        orcamentoId: q.id,
        numero: quoteNumberLabel(q.year, q.seq),
        titulo: q.title,
        empresa: q.company,
        situacao: quoteStatusLabels[q.status],
        valor: currency(quoteTotals(q.status !== "draft" && q.publication ? q.publication : q.content).totalCents),
        validoAte: q.validUntil,
        link: `/orcamentos/${q.id}`,
      })),
      summary: "Consultei os orçamentos",
    };
  },
});

const readQuote = tool({
  name: "ler_orcamento",
  area: "orcamentos",
  description:
    "O conteúdo completo de um orçamento: resumo, stack, fases com horas e tarefas, taxa/hora, entrada, validade, observações, totais e situação. Use para responder sobre um orçamento ou para copiar um existente em outro cliente (passe o id em copiarDeOrcamentoId de criar_orcamento).",
  input: z.object({ orcamentoId: id }),
  run: async ({ actor }, { orcamentoId }) => {
    const [row] = await db
      .select({ quote: quotes, company: companies.name })
      .from(quotes)
      .innerJoin(companies, eq(companies.id, quotes.companyId))
      .where(eq(quotes.id, orcamentoId));
    if (!row || !canAccess(actor, row.quote.companyId, "finance")) throw new ToolError("Orçamento não encontrado.");
    const q = row.quote;
    if (!actor.admin && (q.status === "draft" || q.status === "cancelled")) throw new ToolError("Orçamento não encontrado.");
    const content = q.status !== "draft" && q.publication ? q.publication : q.content;
    const totals = quoteTotals(content);
    return {
      result: {
        orcamentoId: q.id,
        numero: quoteNumberLabel(q.year, q.seq),
        titulo: q.title,
        empresa: row.company,
        companyId: q.companyId,
        situacao: quoteStatusLabels[q.status],
        validoAte: q.validUntil,
        resumo: content.summary,
        stack: content.stack,
        taxaHora: currency(content.hourlyRateCents),
        taxaHoraReais: content.hourlyRateCents / 100,
        entradaPercentual: content.upfrontPercent,
        observacoes: content.notes,
        fases: content.phases.map((f) => ({ nome: f.name, descricao: f.description, horasMin: f.hoursMin, horasMax: f.hoursMax, tarefas: f.tasks.map((t) => ({ titulo: t.title, descricao: t.description })) })),
        esforco: hoursLabel(totals.hoursMin, totals.hoursMax),
        valorTotal: currency(totals.totalCents),
        entrada: currency(totals.upfrontCents),
        saldo: currency(totals.balanceCents),
        link: `/orcamentos/${q.id}`,
      },
      summary: `Li o orçamento "${q.title}"`,
    };
  },
});

const readContract = tool({
  name: "ler_contrato",
  area: "contratos",
  description: "O texto de um contrato (a versão enviada ou assinada), com situação, vigência e assinaturas. Use para responder o que o contrato diz.",
  input: z.object({ contratoId: id }),
  run: async ({ actor }, { contratoId }) => {
    const [row] = await db
      .select({ contract: contracts, company: companies.name })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .where(eq(contracts.id, contratoId));
    if (!row || !canAccess(actor, row.contract.companyId, "finance")) throw new ToolError("Contrato não encontrado.");
    const c = row.contract;
    if (!actor.admin && (c.status === "draft" || c.status === "cancelled")) throw new ToolError("Contrato não encontrado.");
    const text = c.status !== "draft" && c.publication ? c.publication : { title: c.title, body: c.body };
    return {
      result: {
        contratoId: c.id,
        titulo: text.title,
        empresa: row.company,
        situacao: contractStatusLabels[c.status],
        tipo: c.kind === "amendment" ? "aditivo" : "contrato",
        inicio: c.startsAt,
        fim: c.endsAt,
        assinadoEm: c.signedAt?.toISOString() ?? null,
        texto: text.body.slice(0, 20000),
        link: `/contratos/${c.id}`,
      },
      summary: `Li o contrato "${text.title}"`,
    };
  },
});

const createQuoteTool = tool({
  name: "criar_orcamento",
  area: "orcamentos",
  description:
    "Cria um orçamento em rascunho (só a equipe da Anuntech) a partir de título, resumo, taxa/hora, entrada, validade, stack e fases com faixa de horas e tarefas, no formato da proposta da Anuntech. Para fazer 'igual ao orçamento X' para outro cliente, passe copiarDeOrcamentoId (ache o id com listar_orcamentos): tudo é copiado e só o que você informar é trocado. O rascunho abre para revisão e o envio ao cliente é feito na tela. Sem copiarDe, se a taxa/hora não foi dita, pergunte antes de criar.",
  input: z.object({
    companyId: id,
    copiarDeOrcamentoId: id.optional(),
    titulo: z.string().trim().min(1).max(160).optional(),
    resumo: z.string().trim().max(4000).default(""),
    taxaHoraReais: z.number().min(0).max(100000).optional(),
    entradaPercentual: z.number().int().min(0).max(100).optional(),
    validoAte: z.union([z.iso.date(), z.literal("")]).optional(),
    stack: z.array(z.string().trim().min(1).max(160)).max(40).optional(),
    fases: z
      .array(
        z.object({
          nome: z.string().trim().min(1).max(160),
          descricao: z.string().trim().max(4000).default(""),
          horasMin: z.number().min(0).max(100000),
          horasMax: z.number().min(0).max(100000),
          tarefas: z.array(z.object({ titulo: z.string().trim().min(1).max(160), descricao: z.string().trim().max(4000).default("") })).max(200).default([]),
        }),
      )
      .max(60)
      .optional(),
    observacoes: z.string().trim().max(4000).optional(),
  }),
  staffOnly: true,
  write: true,
  run: async ({ actor }, input) => {
    let base: (QuoteContent & { title: string; validUntil: string | null }) | null = null;
    if (input.copiarDeOrcamentoId) {
      const [source] = await db.select().from(quotes).where(eq(quotes.id, input.copiarDeOrcamentoId));
      if (!source || !canAccess(actor, source.companyId, "finance")) throw new ToolError("Orçamento de origem não encontrado.");
      const from = source.status !== "draft" && source.publication ? source.publication : source.content;
      base = { ...from, title: source.title, validUntil: null };
    }
    const fases = input.fases?.length ? input.fases : null;
    if (!base && !fases) throw new ToolError("Informe as fases do orçamento, ou copiarDeOrcamentoId para partir de um existente.");
    const titulo = input.titulo ?? base?.title;
    if (!titulo) throw new ToolError("Informe o título do orçamento.");
    const content: QuoteContent = {
      summary: input.resumo || base?.summary || "",
      stack: input.stack ?? base?.stack ?? [],
      phases: fases
        ? fases.map((f) => {
            const min = Math.round(f.horasMin);
            return { name: f.nome, description: f.descricao, hoursMin: min, hoursMax: Math.max(min, Math.round(f.horasMax)), tasks: f.tarefas.map((t) => ({ title: t.titulo, description: t.descricao })) };
          })
        : base!.phases,
      hourlyRateCents: input.taxaHoraReais !== undefined ? Math.round(input.taxaHoraReais * 100) : (base?.hourlyRateCents ?? 0),
      upfrontPercent: input.entradaPercentual ?? base?.upfrontPercent ?? 50,
      notes: input.observacoes ?? base?.notes ?? DEFAULT_QUOTE_NOTES,
    };
    const state = await submit(createQuote, { companyId: input.companyId, title: titulo, validUntil: input.validoAte ?? "", content: JSON.stringify(content) });
    const totals = quoteTotals(content);
    return {
      result: {
        criado: true,
        rascunho: true,
        link: state.href ?? "/orcamentos",
        esforco: hoursLabel(totals.hoursMin, totals.hoursMax),
        valorTotal: currency(totals.totalCents),
        entrada: currency(totals.upfrontCents),
        saldo: currency(totals.balanceCents),
        proximoPasso: "Revisar na tela e clicar em Enviar ao cliente.",
      },
      summary: `Criei o rascunho do orçamento "${titulo}"`,
    };
  },
});

const fillScreen = tool({
  name: "preencher_tela",
  area: "tela",
  description:
    "Preenche campos do formulário que está na tela da pessoa (veja 'Tela atual' nas instruções): use o nome exato de cada campo. Datas em AAAA-MM-DD, dinheiro como 1234,56, empresa pelo companyId ou pelo nome, selects pelo valor da opção, caixas com 'sim' ou 'não'. Só marque enviar=true se a pessoa pediu para salvar ou enviar; senão preencha e peça que confira. O painel fecha para ela ver a tela.",
  input: z.object({
    campos: z.array(z.object({ campo: z.string().trim().min(1).max(80), valor: z.string().max(10000) })).min(1).max(60),
    enviar: z.boolean().default(false),
  }),
  write: true,
  run: async (_ctx, { campos, enviar }) => ({
    result: { preenchendo: campos.map((c) => c.campo), enviar, aviso: "Os valores são aplicados na tela da pessoa agora; campos com nome errado são ignorados." },
    summary: `Preenchi ${campos.length} ${campos.length === 1 ? "campo" : "campos"} na tela`,
    actions: [{ type: "fill", fields: campos, submit: enviar }],
  }),
});

const clickScreen = tool({
  name: "clicar_na_tela",
  area: "tela",
  description: "Clica em um botão ou link visível na tela da pessoa, pelo texto dele (por exemplo 'Salvar rascunho', 'Enviar ao cliente', 'Nova cobrança'). Use depois de preencher, ou para acionar algo que ela pediu.",
  input: z.object({ texto: z.string().trim().min(1).max(60) }),
  write: true,
  run: async (_ctx, { texto }) => ({ result: { clicando: texto }, summary: `Cliquei em "${texto}"`, actions: [{ type: "click", text: texto }] }),
});

const openSupport = tool({
  name: "abrir_chat_suporte",
  clientOnly: true,
  description: "Abre o chat com a equipe da Anuntech (pessoas de verdade). Só quando a pessoa pede para falar com alguém; nunca como saída para uma ação que você não conseguiu fazer.",
  input: z.object({}),
  run: async () => ({ result: { aberto: true }, summary: "Abri o chat com a equipe da Anuntech", actions: [{ type: "open_support" }] }),
});

export const destinations = {
  painel: { href: "/painel", label: "Visão geral" },
  financeiro: { href: "/financeiro", label: "Financeiro" },
  chamados: { href: "/chamados", label: "Chamados" },
  projetos: { href: "/projetos", label: "Projetos" },
  produtos: { href: "/produtos", label: "Produtos e serviços" },
  contratos: { href: "/contratos", label: "Contratos" },
  orcamentos: { href: "/orcamentos", label: "Orçamentos" },
  bookmarks: { href: "/bookmarks", label: "Bookmarks" },
  conta: { href: "/conta", label: "Minha conta" },
  membros: { href: "/configuracoes/membros", label: "Membros" },
  abrir_chamado: { href: "/chamados/novo", label: "Abrir chamado", area: "support" as const },
  nova_cobranca: { href: "/financeiro/nova", label: "Nova cobrança", staff: true },
  novo_projeto: { href: "/projetos/novo", label: "Novo projeto", staff: true },
  vincular_produto: { href: "/produtos/novo", label: "Vincular produto ou serviço", staff: true },
  novo_orcamento: { href: "/orcamentos/novo", label: "Novo orçamento", staff: true },
  novo_contrato: { href: "/contratos/novo", label: "Novo contrato", staff: true },
  cadastrar_empresa: { href: "/empresas/nova", label: "Cadastrar empresa", staff: true },
  empresas: { href: "/empresas", label: "Empresas", staff: true },
} satisfies Record<string, { href: string; label: string; staff?: boolean; area?: Area }>;
export type Destination = keyof typeof destinations;

/** The screen a person may open, with its permission check; throws a ToolError otherwise. */
export function screenFor(actor: Actor, destino: Destination, companyId?: string) {
  const target = destinations[destino] as { href: string; label: string; staff?: boolean; area?: Area };
  if (target.staff && !actor.admin) throw new ToolError("Essa tela é só da equipe da Anuntech.");
  if (target.area && !actor.admin && !allowedIds(actor, target.area).length) throw new ToolError("Seu acesso não inclui essa tela.");
  if (companyId && !canAccess(actor, companyId, target.area ?? "overview")) throw new ToolError("Você não tem acesso a essa empresa.");
  const creation = target.href.endsWith("/novo") || target.href.endsWith("/nova");
  return { label: target.label, href: companyId && creation ? `${target.href}?companyId=${companyId}` : target.href };
}

const openScreen = tool({
  name: "abrir_tela",
  description:
    "Leva a pessoa a uma tela do Console (o painel fecha e a tela abre). Para criar cobranças, orçamentos, contratos, projetos ou cadastrar empresas, esta é a única forma: essas telas são preenchidas pela pessoa. Passe companyId quando a tela for de criação e a empresa já estiver definida.",
  input: z.object({ destino: z.enum(Object.keys(destinations) as [Destination, ...Destination[]]), companyId: id.optional() }),
  run: async ({ actor }, { destino, companyId }) => {
    const screen = screenFor(actor, destino, companyId);
    return { result: { aberta: screen.label, link: screen.href }, summary: `Abri ${screen.label}`, actions: [{ type: "navigate", href: screen.href }] };
  },
});

const searchKnowledge = tool({
  name: "buscar_conhecimento",
  description: "Procura na base de conhecimento da Anuntech (documentos mantidos pela equipe) trechos que respondam a uma dúvida sobre a empresa, produtos, políticas ou processos.",
  input: z.object({ consulta: z.string().trim().min(2).max(200) }),
  run: async (_ctx, { consulta }) => {
    const docs = await db.select({ name: assistantDocuments.name, content: assistantDocuments.content }).from(assistantDocuments);
    const words = fold(consulta).split(/\W+/).filter((w) => w.length > 2);
    const hits: { documento: string; trecho: string; score: number }[] = [];
    for (const doc of docs) {
      for (const paragraph of doc.content.split(/\n\s*\n/)) {
        const text = fold(paragraph);
        const score = words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
        if (score > 0) hits.push({ documento: doc.name, trecho: paragraph.trim().slice(0, 1200), score });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return { result: hits.slice(0, 8).map(({ documento, trecho }) => ({ documento, trecho })), summary: "Procurei na base de conhecimento" };
  },
});

export const assistantTools: AnyTool[] = [
  listCompanies,
  companyOverview,
  listInvoices,
  financeSummary,
  listTickets,
  readTicket,
  openTicket,
  answerTicket,
  listWorks,
  listTasks,
  addTask,
  moveTaskTool,
  addProject,
  listContracts,
  listQuotes,
  readQuote,
  readContract,
  createQuoteTool,
  fillScreen,
  clickScreen,
  openSupport,
  openScreen,
  searchKnowledge,
  ...extraTools,
];

/**
 * The tool list as OpenRouter/OpenAI expect it, filtered by who is asking
 * and, when Jev has read the message, by the areas it touches: core tools
 * (listings, navigation, support, knowledge) always go; the rest only when
 * their area is selected. `null` sends everything.
 */
export function toolCatalog(actor: Pick<Actor, "admin">, areas: ReadonlySet<ToolArea> | null = null) {
  return assistantTools
    .filter((t) => !t.staffOnly || actor.admin)
    .filter((t) => !t.clientOnly || !actor.admin)
    .filter((t) => !areas || !t.area || areas.has(t.area))
    .map((t) => {
      const schema = z.toJSONSchema(t.input) as Record<string, unknown>;
      delete schema.$schema;
      return { type: "function" as const, function: { name: t.name, description: t.description, parameters: schema } };
    });
}

/** Runs one tool call; errors come back as text the model can relay. */
export async function runTool(ctx: ToolContext, name: string, rawArguments: string): Promise<ToolOutcome | { error: string }> {
  const def = assistantTools.find((t) => t.name === name);
  if (!def || (def.staffOnly && !ctx.actor.admin) || (def.clientOnly && ctx.actor.admin)) return { error: `Ferramenta desconhecida: ${name}.` };
  let parsed: unknown;
  try {
    parsed = rawArguments ? JSON.parse(rawArguments) : {};
  } catch {
    return { error: "Os argumentos não vieram em JSON válido." };
  }
  let input = def.input.safeParse(withoutNulls(parsed));
  if (!input.success) {
    // Models often send optional fields as "" instead of leaving them out; drop the
    // empty strings validation rejected and try once more before reporting.
    const retry = withoutEmpty(withoutNulls(parsed), input.error.issues);
    if (retry !== null) input = def.input.safeParse(retry);
  }
  if (!input.success) {
    const error = describeIssues(input.error.issues);
    console.warn("[assistant] tool rejected its arguments", { tool: name, error });
    return { error };
  }
  try {
    return await def.run(ctx, input.data as never);
  } catch (error) {
    if (error instanceof ToolError) {
      console.warn("[assistant] tool refused", { tool: name, error: error.message });
      return { error: error.message };
    }
    console.error(`[assistant] ${name} failed`, error);
    return { error: "A ferramenta falhou por um erro interno. Sugira tentar de novo ou falar com a equipe." };
  }
}

/** Removes null values (an optional field "not informed"), at any depth. */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, withoutNulls(v)]));
  return value;
}

type Issue = { path: PropertyKey[]; code: string; message: string; expected?: unknown; format?: string; values?: unknown[] };

/** A copy without the empty strings that failed validation, or null when there are none to drop. */
function withoutEmpty(value: unknown, issues: readonly Issue[]): unknown {
  const copy = structuredClone(value) as Record<string, unknown>;
  let dropped = false;
  for (const issue of issues) {
    let parent: unknown = copy;
    for (const key of issue.path.slice(0, -1)) parent = (parent as Record<PropertyKey, unknown> | undefined)?.[key as string];
    const last = issue.path.at(-1);
    if (parent && typeof parent === "object" && last !== undefined && (parent as Record<string, unknown>)[last as string] === "") {
      delete (parent as Record<string, unknown>)[last as string];
      dropped = true;
    }
  }
  return dropped ? copy : null;
}

/** Validation errors in Portuguese, saying what to send instead. */
function describeIssues(issues: readonly Issue[]) {
  const what = (issue: Issue) => {
    if (issue.code === "invalid_format")
      return issue.format === "uuid"
        ? "id inválido: use exatamente um id devolvido por outra ferramenta, ou omita o campo se ele é opcional"
        : issue.format === "date"
          ? "data inválida: use AAAA-MM-DD"
          : `formato inválido (${issue.format})`;
    if (issue.code === "invalid_type") return issue.expected === "undefined" ? "campo desconhecido, omita" : `tipo errado: esperava ${String(issue.expected)}`;
    if (issue.code === "invalid_value" && issue.values?.length) return `use um destes valores: ${issue.values.join(", ")}`;
    if (issue.code === "too_small") return "valor abaixo do mínimo ou vazio";
    if (issue.code === "too_big") return "valor acima do máximo";
    if (issue.code === "unrecognized_keys") return "campos que a ferramenta não aceita, omita-os";
    return issue.message;
  };
  const list = issues.map((issue) => `${issue.path.join(".") || "(dados)"}: ${what(issue)}`).join("; ");
  return `Dados inválidos para a ferramenta: ${list}. Corrija só esses campos e chame a ferramenta de novo; campos opcionais que não se aplicam devem ser omitidos.`;
}

export const writeToolNames = new Set(assistantTools.filter((t) => t.write).map((t) => t.name));
