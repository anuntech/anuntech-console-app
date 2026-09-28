import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { canAccess, type Actor } from "./access";
import {
  attachments,
  billingNotices,
  bookmarkFolders,
  bookmarks,
  catalogItems,
  companies,
  contractTemplates,
  contracts,
  engagements,
  invoices,
  memberships,
  quotes,
  subscriptions,
  taskAssignees,
  taskComments,
  tasks,
  user,
} from "@/db/schema";
import {
  cancelDraft,
  createCompany,
  createInvoice,
  updateCompany,
  updateDraft,
  updateEngagement,
  updateTicket,
} from "./actions";
import { addTaskComment, deleteTask, deleteTaskComment, updateProject, updateTask, updateTaskComment } from "./task-actions";
import { createFolder, saveBookmark } from "./bookmark-actions";
import { addCatalogEngagement, saveCatalogItem } from "./catalog-actions";
import { createContract, setContractTerm } from "./contract-actions";
import { duplicateQuote, saveQuote } from "./quote-actions";
import { saveCompanyMember } from "./members-actions";
import { addressLabel } from "./company-billing";
import { formatDocument, formatPhone } from "./company-input";
import { currency, engagementLabels, priorityLabels, roleLabels, ticketLabels } from "./format";
import { hasPermission } from "./permissions";
import { quoteTotals, type QuoteContent } from "./quote-model";
import { estimateLabel, minutesToHours, TASK_PRIORITIES, TASK_STATUSES, taskPriorityLabels, taskStatusLabels } from "./task-model";
import { civilDate, id, limit, reais, resolvePeople, scopeOf, submit, tool, ToolError, within, fold } from "./assistant-tools-kit";
import { projectPeople } from "./tasks";

const invoiceSituation = (status: string, dueDate: string, today: string) =>
  status === "paid" ? "paga" : status === "cancelled" ? "cancelada" : status === "draft" ? "rascunho (não emitida)" : dueDate < today ? "vencida" : "em aberto";

const managerOf = (actor: Actor, companyId: string) => actor.admin || actor.grants.some((g) => g.company.id === companyId && g.role === "manager");

/* ============================================================ reads */

const readCompany = tool({
  name: "ler_empresa",
  area: "empresas",
  description: "Os dados de uma empresa: razão social, CNPJ, e-mail de cobrança, telefone, endereço, situação e as pessoas com acesso (para gestores e equipe).",
  input: z.object({ companyId: id }),
  run: async ({ actor }, { companyId }) => {
    if (!canAccess(actor, companyId, "overview")) throw new ToolError("Você não tem acesso a essa empresa.");
    const [c] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!c) throw new ToolError("Empresa não encontrada.");
    const finance = actor.admin || hasPermission(actor.grants.find((g) => g.company.id === companyId)!.role, "finance");
    const people = managerOf(actor, companyId)
      ? await db
          .select({ email: memberships.email, role: memberships.role, active: memberships.active, name: user.name })
          .from(memberships)
          .leftJoin(user, eq(user.email, memberships.email))
          .where(eq(memberships.companyId, companyId))
      : null;
    return {
      result: {
        companyId: c.id,
        nome: c.name,
        cnpj: formatDocument(c.document),
        arquivada: c.archived,
        ...(finance
          ? {
              emailCobranca: c.billingEmail,
              telefone: c.phone ? formatPhone(c.phone) : null,
              endereco: c.billingAddress ? addressLabel(c.billingAddress) : null,
              notaFiscalAutomatica: c.autoIssueNfse,
            }
          : {}),
        pessoas: people?.map((p) => ({ nome: p.name, email: p.email, papel: roleLabels[p.role] ?? p.role, ativo: p.active })) ?? "sem acesso à lista",
        links: { empresa: actor.admin ? `/empresas/${c.id}` : null, faturas: `/financeiro?company=${c.id}`, chamados: `/chamados?company=${c.id}`, projetos: `/projetos?company=${c.id}` },
      },
      summary: `Li os dados de ${c.name}`,
    };
  },
});

const readProject = tool({
  name: "ler_projeto",
  area: "projetos",
  description: "Um projeto, produto ou serviço em detalhe: descrição, situação, link e, para projetos, quantas tarefas há em cada coluna do quadro.",
  input: z.object({ engagementId: id }),
  run: async ({ actor }, { engagementId }) => {
    const [w] = await db.select({ e: engagements, company: companies.name }).from(engagements).innerJoin(companies, eq(companies.id, engagements.companyId)).where(eq(engagements.id, engagementId));
    if (!w || !canAccess(actor, w.e.companyId, "overview")) throw new ToolError("Projeto não encontrado.");
    const [board, people] =
      w.e.kind === "project"
        ? await Promise.all([db.select({ status: tasks.status }).from(tasks).where(eq(tasks.engagementId, engagementId)), projectPeople(w.e.companyId)])
        : [[], []];
    const counts = Object.fromEntries(TASK_STATUSES.map((s) => [taskStatusLabels[s], board.filter((t) => t.status === s).length]));
    return {
      result: {
        engagementId: w.e.id,
        nome: w.e.name,
        empresa: w.company,
        companyId: w.e.companyId,
        tipo: engagementLabels[w.e.kind] ?? w.e.kind,
        situacao: engagementLabels[w.e.status] ?? w.e.status,
        descricao: w.e.description,
        url: w.e.url,
        valor: w.e.amountCents ? currency(w.e.amountCents) : null,
        ...(w.e.kind === "project"
          ? { tarefasPorColuna: counts, totalTarefas: board.length, pessoas: people.map((p) => ({ userId: p.id, nome: p.name || p.email, email: p.email })) }
          : {}),
        link: w.e.kind === "project" ? `/projetos/${w.e.id}` : w.e.kind === "service" ? `/produtos/${w.e.id}` : (w.e.url ?? "/produtos"),
      },
      summary: `Li ${w.e.name}`,
    };
  },
});

async function taskWithAccess(actor: Actor, taskId: string) {
  const [t] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!t || !canAccess(actor, t.companyId, "overview")) throw new ToolError("Tarefa não encontrada.");
  return t;
}

const readTask = tool({
  name: "ler_tarefa",
  area: "projetos",
  description: "Uma tarefa em detalhe: descrição, situação, prioridade, prazo, estimativa, etiquetas, responsáveis, anexos e os comentários (os 30 mais recentes, com id, autor e data).",
  input: z.object({ tarefaId: id }),
  run: async ({ actor }, { tarefaId }) => {
    const t = await taskWithAccess(actor, tarefaId);
    const [people, files, said] = await Promise.all([
      db.select({ name: user.name, email: user.email }).from(taskAssignees).innerJoin(user, eq(user.id, taskAssignees.userId)).where(eq(taskAssignees.taskId, t.id)),
      db.select({ name: attachments.name, commentId: attachments.commentId }).from(attachments).where(eq(attachments.taskId, t.id)),
      db
        .select({ id: taskComments.id, body: taskComments.body, createdAt: taskComments.createdAt, editedAt: taskComments.editedAt, authorId: user.id, name: user.name, email: user.email })
        .from(taskComments)
        .innerJoin(user, eq(user.id, taskComments.authorId))
        .where(eq(taskComments.taskId, t.id))
        .orderBy(desc(taskComments.createdAt))
        .limit(30),
    ]);
    return {
      result: {
        tarefaId: t.id,
        engagementId: t.engagementId,
        titulo: t.title,
        descricao: t.description,
        situacao: taskStatusLabels[t.status as keyof typeof taskStatusLabels] ?? t.status,
        prioridade: taskPriorityLabels[t.priority],
        prazo: t.dueDate,
        estimativa: t.estimateMinutes ? estimateLabel(t.estimateMinutes) : null,
        etiquetas: t.labels ?? [],
        responsaveis: people.map((p) => p.name || p.email),
        anexos: files.filter((f) => !f.commentId).map((f) => f.name),
        // Oldest first, like the sheet shows them.
        comentarios: said.reverse().map((c) => ({
          comentarioId: c.id,
          autor: c.authorId === actor.user.id ? "você" : c.name || c.email,
          quando: c.createdAt.toISOString(),
          ...(c.editedAt ? { editadoEm: c.editedAt.toISOString() } : {}),
          texto: c.body.slice(0, 1500),
          anexos: files.filter((f) => f.commentId === c.id).map((f) => f.name),
        })),
        link: `/projetos/${t.engagementId}`,
      },
      summary: `Li a tarefa "${t.title}"`,
    };
  },
});

const readInvoice = tool({
  name: "ler_fatura",
  area: "financeiro",
  description: "Uma fatura em detalhe: valor, vencimento e 'pagar até', situação, descontos e juros, link de pagamento, boleto, Pix, nota fiscal e os avisos enviados.",
  input: z.object({ faturaId: id }),
  run: async ({ actor, today }, { faturaId }) => {
    const [row] = await db.select({ i: invoices, company: companies.name }).from(invoices).innerJoin(companies, eq(companies.id, invoices.companyId)).where(eq(invoices.id, faturaId));
    if (!row || !canAccess(actor, row.i.companyId, "finance")) throw new ToolError("Fatura não encontrada.");
    const i = row.i;
    if (!actor.admin && i.status === "draft") throw new ToolError("Fatura não encontrada.");
    const notices = await db
      .select({ channel: billingNotices.channel, recipient: billingNotices.recipient, kind: billingNotices.kind, status: billingNotices.status, at: billingNotices.createdAt })
      .from(billingNotices)
      .where(eq(billingNotices.invoiceId, i.id))
      .orderBy(desc(billingNotices.createdAt))
      .limit(10);
    const payable = i.status === "issued" || i.status === "paid";
    return {
      result: {
        faturaId: i.id,
        empresa: row.company,
        companyId: i.companyId,
        descricao: i.description,
        valor: currency(i.amountCents),
        vencimento: i.dueDate,
        pagarAte: i.bankDueDate ?? i.dueDate,
        situacao: invoiceSituation(i.status, i.dueDate, today),
        desconto: i.discountCents ? currency(i.discountCents) : null,
        multaPercentual: i.fineBps ? i.fineBps / 100 : null,
        jurosMensalPercentual: i.interestMonthlyBps ? i.interestMonthlyBps / 100 : null,
        recorrente: !!i.subscriptionId,
        linkPagamento: payable && i.publicEnabled && i.publicId ? `/pagar/${i.publicId}` : null,
        boletoPdf: i.status === "issued" && (i.boletoLine || i.boletoUrl) ? `/api/boletos/${i.id}` : null,
        linhaDigitavel: i.boletoLine,
        pixDisponivel: !!i.pixCopyPaste,
        notaFiscal: i.fiscalStatus,
        avisos: notices.map((n) => ({ canal: n.channel, para: n.recipient, tipo: n.kind, situacao: n.status, em: n.at.toISOString() })),
        detalhe: `/financeiro/${i.id}`,
      },
      summary: `Li a fatura "${i.description}"`,
    };
  },
});

const listSubscriptions = tool({
  name: "listar_recorrencias",
  area: "financeiro",
  description: "As cobranças recorrentes (assinaturas) de uma empresa: valor, intervalo, próximo vencimento, situação e o erro da última emissão, se houver.",
  input: z.object({ companyId: id.optional() }),
  run: async ({ actor }, { companyId }) => {
    const ids = scopeOf(actor, "finance", companyId);
    const rows = await db
      .select({ s: subscriptions, company: companies.name })
      .from(subscriptions)
      .innerJoin(companies, eq(companies.id, subscriptions.companyId))
      .where(and(within(subscriptions.companyId, ids), actor.admin ? undefined : inArray(subscriptions.status, ["active", "paused"])))
      .orderBy(asc(subscriptions.nextDueDate))
      .limit(50);
    return {
      result: rows.map((r) => ({
        recorrenciaId: r.s.id,
        empresa: r.company,
        descricao: r.s.description,
        valor: currency(r.s.amountCents),
        intervalo: r.s.interval === "yearly" ? "anual" : "mensal",
        proximoVencimento: r.s.nextDueDate,
        situacao: { draft: "rascunho", active: "ativa", paused: "pausada", cancelled: "cancelada" }[r.s.status],
        ultimoErro: r.s.lastError,
        link: `/financeiro?company=${r.s.companyId}`,
      })),
      summary: "Consultei as recorrências",
    };
  },
});

const listBookmarks = tool({
  name: "listar_bookmarks",
  area: "bookmarks",
  description: "Os bookmarks (links e arquivos guardados) que a pessoa vê, com pasta e empresa; aceita uma busca por título.",
  input: z.object({ companyId: id.optional(), busca: z.string().trim().max(80).optional(), limite: limit(20) }),
  run: async ({ actor }, { companyId, busca, limite }) => {
    const ids = actor.admin ? null : scopeOf(actor, "overview", companyId);
    const rows = await db
      .select({ b: bookmarks, folder: bookmarkFolders.name, company: companies.name })
      .from(bookmarks)
      .leftJoin(bookmarkFolders, eq(bookmarkFolders.id, bookmarks.folderId))
      .leftJoin(companies, eq(companies.id, bookmarks.companyId))
      .where(
        and(
          companyId ? eq(bookmarks.companyId, companyId) : ids ? or(inArray(bookmarks.companyId, ids), and(isNull(bookmarks.companyId), eq(bookmarks.ownerId, actor.user.id))) : undefined,
          busca ? ilike(bookmarks.title, `%${busca}%`) : undefined,
        ),
      )
      .orderBy(desc(bookmarks.updatedAt))
      .limit(limite);
    return {
      result: rows.map((r) => ({
        bookmarkId: r.b.id,
        titulo: r.b.title,
        url: r.b.url,
        arquivo: r.b.fileName,
        pasta: r.folder,
        empresa: r.company ?? "Anuntech",
        link: r.b.url ?? `/api/bookmarks/${r.b.id}`,
      })),
      summary: "Consultei os bookmarks",
    };
  },
});

const listCatalog = tool({
  name: "listar_catalogo",
  area: "produtos",
  description: "O catálogo da Anuntech (produtos e serviços que podem ser vinculados a uma empresa), com preço padrão e intervalo. Só equipe.",
  input: z.object({}),
  staffOnly: true,
  run: async () => {
    const rows = await db.select().from(catalogItems).orderBy(asc(catalogItems.name));
    return {
      result: rows.map((c) => ({
        catalogItemId: c.id,
        tipo: c.kind === "product" ? "produto" : "serviço",
        nome: c.name,
        descricao: c.description,
        url: c.url,
        valorPadrao: c.defaultAmountCents ? currency(c.defaultAmountCents) : null,
        intervalo: c.interval === "yearly" ? "anual" : c.interval === "monthly" ? "mensal" : null,
        ativo: c.active,
      })),
      summary: "Consultei o catálogo",
    };
  },
});

const listContractTemplates = tool({
  name: "listar_modelos_de_contrato",
  area: "contratos",
  description: "Os modelos de contrato disponíveis para criar um contrato. Só equipe.",
  input: z.object({}),
  staffOnly: true,
  run: async () => {
    const rows = await db.select({ id: contractTemplates.id, name: contractTemplates.name, description: contractTemplates.description, active: contractTemplates.active }).from(contractTemplates).orderBy(asc(contractTemplates.name));
    return { result: rows.map((t) => ({ templateId: t.id, nome: t.name, descricao: t.description, ativo: t.active })), summary: "Consultei os modelos de contrato" };
  },
});

const listBillingNotices = tool({
  name: "listar_envios_de_cobranca",
  area: "financeiro",
  description: "Os avisos de cobrança enviados por e-mail e WhatsApp (emissão, lembretes, atraso), com destinatário e situação da entrega. Só equipe.",
  input: z.object({ companyId: id.optional(), faturaId: id.optional(), limite: limit(20) }),
  staffOnly: true,
  run: async (_ctx, { companyId, faturaId, limite }) => {
    const rows = await db
      .select({ n: billingNotices, description: invoices.description, company: companies.name })
      .from(billingNotices)
      .innerJoin(invoices, eq(invoices.id, billingNotices.invoiceId))
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      .where(and(faturaId ? eq(billingNotices.invoiceId, faturaId) : undefined, companyId ? eq(invoices.companyId, companyId) : undefined))
      .orderBy(desc(billingNotices.createdAt))
      .limit(limite);
    return {
      result: rows.map((r) => ({ empresa: r.company, fatura: r.description, faturaId: r.n.invoiceId, canal: r.n.channel, para: r.n.recipient, tipo: r.n.kind, situacao: r.n.status, em: r.n.createdAt.toISOString() })),
      summary: "Consultei os envios de cobrança",
    };
  },
});

const myAccount = tool({
  name: "minha_conta",
  description: "Quem está falando: nome, e-mail, se é da equipe da Anuntech e as empresas com o papel em cada uma.",
  input: z.object({}),
  run: async ({ actor }) => ({
    result: {
      nome: actor.user.name,
      email: actor.user.email,
      equipeAnuntech: actor.admin,
      empresas: actor.grants.map((g) => ({ companyId: g.company.id, nome: g.company.name, papel: roleLabels[g.role] ?? g.role })),
      links: { conta: "/conta", aparencia: "/configuracoes/aparencia", seguranca: "/configuracoes/seguranca" },
    },
    summary: "Consultei a conta",
  }),
});

/* ============================================================ writes */

const editTask = tool({
  name: "atualizar_tarefa",
  area: "projetos",
  description:
    "Altera uma ou várias tarefas de uma vez: título, descrição, situação, prioridade, prazo, estimativa em horas ou responsáveis. Só o que for informado muda. Para 'todas as tarefas', passe a lista em tarefaIds. responsaveis substitui a lista da tarefa: ids de pessoas (ler_projeto lista quem pode) ou 'eu' para a própria pessoa; [] tira todo mundo.",
  input: z
    .object({
      tarefaId: id.optional(),
      tarefaIds: z.array(id).min(1).max(100).optional(),
      titulo: z.string().trim().min(1).max(160).optional(),
      descricao: z.string().trim().max(5000).optional(),
      situacao: z.enum(TASK_STATUSES).optional(),
      prioridade: z.enum(TASK_PRIORITIES).optional(),
      prazo: civilDate.optional(),
      estimativaHoras: z.number().min(0).max(1000).optional(),
      responsaveis: z.array(z.string().trim().min(1).max(128)).max(10).optional(),
    })
    .refine((v) => v.tarefaId || v.tarefaIds?.length, { message: "Informe tarefaId ou tarefaIds." }),
  write: true,
  run: async ({ actor }, input) => {
    const ids = [...new Set([...(input.tarefaId ? [input.tarefaId] : []), ...(input.tarefaIds ?? [])])];
    const assignees = resolvePeople(actor, input.responsaveis);
    const done: { tarefaId: string; titulo: string }[] = [];
    const failed: { tarefaId: string; erro: string }[] = [];
    let link = "/projetos";
    for (const tarefaId of ids) {
      try {
        const t = await taskWithAccess(actor, tarefaId);
        link = `/projetos/${t.engagementId}`;
        const people = assignees ?? (await db.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, t.id))).map((p) => p.userId);
        await submit(
          updateTask,
          {
            id: t.id,
            title: input.titulo ?? t.title,
            description: input.descricao ?? t.description ?? "",
            status: input.situacao ?? t.status,
            priority: input.prioridade ?? t.priority,
            dueDate: input.prazo ?? t.dueDate ?? "",
            estimate: input.estimativaHoras !== undefined ? String(input.estimativaHoras).replace(".", ",") : t.estimateMinutes ? minutesToHours(t.estimateMinutes) : "",
          },
          { labels: t.labels ?? [], assigneeIds: people },
        );
        done.push({ tarefaId: t.id, titulo: input.titulo ?? t.title });
      } catch (error) {
        failed.push({ tarefaId, erro: error instanceof ToolError ? error.message : "Não consegui atualizar." });
      }
    }
    if (!done.length) throw new ToolError(failed[0]?.erro ?? "Nenhuma tarefa atualizada.");
    return {
      result: { atualizadas: done.length, tarefas: done, ...(failed.length ? { falhas: failed } : {}), link },
      summary: done.length === 1 ? `Atualizei a tarefa "${done[0].titulo}"` : `Atualizei ${done.length} tarefas`,
    };
  },
});

const removeTask = tool({
  name: "excluir_tarefa",
  area: "projetos",
  description: "Exclui uma tarefa do quadro (equipe, ou quem a criou). Confirme antes: não tem volta.",
  input: z.object({ tarefaId: id }),
  write: true,
  run: async ({ actor }, { tarefaId }) => {
    const t = await taskWithAccess(actor, tarefaId);
    await submit(deleteTask, { id: t.id });
    return { result: { excluida: true, link: `/projetos/${t.engagementId}` }, summary: `Excluí a tarefa "${t.title}"` };
  },
});

const commentTask = tool({
  name: "comentar_tarefa",
  area: "projetos",
  description:
    "Publica um comentário numa tarefa, em nome da pessoa (aparece na aba Comentários da tarefa, para a equipe e o cliente). Para o mesmo comentário em várias tarefas, passe a lista em tarefaIds. Escreva o texto como a pessoa pediu; se ela só deu a ideia, mostre o texto e confirme antes.",
  input: z
    .object({
      tarefaId: id.optional(),
      tarefaIds: z.array(id).min(1).max(50).optional(),
      texto: z.string().trim().min(1).max(5000),
    })
    .refine((v) => v.tarefaId || v.tarefaIds?.length, { message: "Informe tarefaId ou tarefaIds." }),
  write: true,
  run: async ({ actor }, input) => {
    const ids = [...new Set([...(input.tarefaId ? [input.tarefaId] : []), ...(input.tarefaIds ?? [])])];
    const done: { tarefaId: string; titulo: string }[] = [];
    const failed: { tarefaId: string; erro: string }[] = [];
    let link = "/projetos";
    for (const tarefaId of ids) {
      try {
        const t = await taskWithAccess(actor, tarefaId);
        link = `/projetos/${t.engagementId}`;
        await submit(addTaskComment, { taskId: t.id, body: input.texto });
        done.push({ tarefaId: t.id, titulo: t.title });
      } catch (error) {
        failed.push({ tarefaId, erro: error instanceof ToolError ? error.message : "Não consegui comentar." });
      }
    }
    if (!done.length) throw new ToolError(failed[0]?.erro ?? "Nenhum comentário publicado.");
    return {
      result: { comentadas: done.length, tarefas: done, ...(failed.length ? { falhas: failed } : {}), link },
      summary: done.length === 1 ? `Comentei na tarefa "${done[0].titulo}"` : `Comentei em ${done.length} tarefas`,
    };
  },
});

const editComment = tool({
  name: "editar_comentario_tarefa",
  area: "projetos",
  description: "Troca o texto de um comentário de tarefa (o id vem de ler_tarefa). Só comentários da própria pessoa; o comentário passa a mostrar \"editado\". Mostre o texto novo e confirme antes.",
  input: z.object({ comentarioId: id, texto: z.string().trim().min(1).max(5000) }),
  write: true,
  run: async ({ actor }, { comentarioId, texto }) => {
    const [c] = await db.select({ taskId: taskComments.taskId }).from(taskComments).where(eq(taskComments.id, comentarioId));
    if (!c) throw new ToolError("Comentário não encontrado.");
    const t = await taskWithAccess(actor, c.taskId);
    await submit(updateTaskComment, { id: comentarioId, body: texto });
    return { result: { editado: true, link: `/projetos/${t.engagementId}` }, summary: `Editei um comentário da tarefa "${t.title}"` };
  },
});

const uncommentTask = tool({
  name: "excluir_comentario_tarefa",
  area: "projetos",
  description: "Exclui um comentário de tarefa (o id vem de ler_tarefa). Só quem escreveu, ou a equipe. Confirme antes: não tem volta.",
  input: z.object({ comentarioId: id }),
  write: true,
  run: async ({ actor }, { comentarioId }) => {
    const [c] = await db
      .select({ taskId: taskComments.taskId })
      .from(taskComments)
      .where(eq(taskComments.id, comentarioId));
    if (!c) throw new ToolError("Comentário não encontrado.");
    const t = await taskWithAccess(actor, c.taskId);
    await submit(deleteTaskComment, { id: comentarioId });
    return { result: { excluido: true, link: `/projetos/${t.engagementId}` }, summary: `Excluí um comentário da tarefa "${t.title}"` };
  },
});

const editProject = tool({
  name: "atualizar_projeto",
  area: "projetos",
  description: "Altera um projeto, produto ou serviço: nome, descrição ou situação (active, paused, completed). Só equipe.",
  input: z.object({
    engagementId: id,
    nome: z.string().trim().min(1).max(160).optional(),
    descricao: z.string().trim().max(3000).optional(),
    situacao: z.enum(["active", "paused", "completed"]).optional(),
  }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const [w] = await db.select().from(engagements).where(eq(engagements.id, input.engagementId));
    if (!w) throw new ToolError("Projeto não encontrado.");
    if (input.nome !== undefined || input.descricao !== undefined)
      await submit(updateProject, { id: w.id, name: input.nome ?? w.name, description: input.descricao ?? w.description ?? "", url: w.url ?? undefined, amount: w.amountCents ? reais(w.amountCents / 100) : undefined });
    if (input.situacao && input.situacao !== w.status) await submit(updateEngagement, { id: w.id, status: input.situacao });
    return { result: { atualizado: true, link: w.kind === "project" ? `/projetos/${w.id}` : "/produtos" }, summary: `Atualizei ${input.nome ?? w.name}` };
  },
});

const editTicket = tool({
  name: "atualizar_chamado",
  area: "chamados",
  description: "Muda a situação (open, in_progress, waiting_customer, resolved, closed), a prioridade (normal, high) ou o responsável (e-mail da equipe) de um chamado. Só equipe.",
  input: z.object({
    chamadoId: id,
    situacao: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]).optional(),
    prioridade: z.enum(["normal", "high"]).optional(),
    responsavelEmail: z.string().trim().email().optional(),
  }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    await submit(updateTicket, { ticketId: input.chamadoId, status: input.situacao, priority: input.prioridade, assignedTo: input.responsavelEmail });
    return {
      result: { atualizado: true, situacao: input.situacao ? ticketLabels[input.situacao] : undefined, prioridade: input.prioridade ? priorityLabels[input.prioridade] : undefined, link: `/chamados/${input.chamadoId}` },
      summary: "Atualizei o chamado",
    };
  },
});

const draftInvoice = tool({
  name: "criar_cobranca_rascunho",
  area: "financeiro",
  description:
    "Cria uma cobrança avulsa em rascunho para uma empresa (só equipe): descrição, valor em reais, vencimento e, se for diferente, a data limite do boleto. O rascunho NÃO é emitido nem enviado: publicar no banco é feito na tela da fatura. Recorrências continuam sendo criadas na tela.",
  input: z.object({
    companyId: id,
    descricao: z.string().trim().min(1).max(1000),
    valorReais: z.number().positive().max(9999999.99),
    vencimento: z.iso.date(),
    pagarAte: z.iso.date().optional(),
    engagementId: id.optional(),
  }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const state = await submit(createInvoice, {
      companyId: input.companyId,
      engagementId: input.engagementId ?? "",
      description: input.descricao,
      amount: reais(input.valorReais),
      dueDate: input.vencimento,
      bankDueDate: input.pagarAte ?? "",
      billingType: "one_time",
    });
    return { result: { criada: true, rascunho: true, link: state.href ?? "/financeiro", proximoPasso: "Revisar e publicar no Inter pela tela da fatura." }, summary: `Criei o rascunho da cobrança "${input.descricao}"` };
  },
});

const editDraftInvoice = tool({
  name: "atualizar_cobranca_rascunho",
  area: "financeiro",
  description: "Altera uma cobrança ainda em rascunho: descrição, valor, vencimento ou 'pagar até'. Só equipe; faturas emitidas não passam por aqui.",
  input: z.object({ faturaId: id, descricao: z.string().trim().min(1).max(1000).optional(), valorReais: z.number().positive().max(9999999.99).optional(), vencimento: z.iso.date().optional(), pagarAte: civilDate.optional() }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const [i] = await db.select().from(invoices).where(eq(invoices.id, input.faturaId));
    if (!i) throw new ToolError("Fatura não encontrada.");
    if (i.status !== "draft") throw new ToolError("Só rascunhos podem ser alterados por aqui; para uma fatura emitida, use a tela dela.");
    await submit(updateDraft, { id: i.id, description: input.descricao ?? i.description, amount: reais(input.valorReais ?? i.amountCents / 100), dueDate: input.vencimento ?? i.dueDate, bankDueDate: input.pagarAte ?? i.bankDueDate ?? "" });
    return { result: { atualizada: true, link: `/financeiro/${i.id}` }, summary: `Atualizei o rascunho "${input.descricao ?? i.description}"` };
  },
});

const dropDraftInvoice = tool({
  name: "cancelar_cobranca_rascunho",
  area: "financeiro",
  description: "Cancela uma cobrança em rascunho (só equipe). Faturas emitidas não são canceladas por aqui.",
  input: z.object({ faturaId: id }),
  staffOnly: true,
  write: true,
  run: async (_ctx, { faturaId }) => {
    const [i] = await db.select({ description: invoices.description, status: invoices.status }).from(invoices).where(eq(invoices.id, faturaId));
    if (!i) throw new ToolError("Fatura não encontrada.");
    if (i.status !== "draft") throw new ToolError("Só rascunhos podem ser cancelados por aqui.");
    await submit(cancelDraft, { id: faturaId });
    return { result: { cancelada: true }, summary: `Cancelei o rascunho "${i.description}"` };
  },
});

const addCompany = tool({
  name: "cadastrar_empresa",
  area: "empresas",
  description: "Cadastra uma empresa cliente (só equipe): razão social, CNPJ ou CPF, e-mail de cobrança e telefone. Confirme os dados antes.",
  input: z.object({ nome: z.string().trim().min(1).max(160), documento: z.string().trim().min(11).max(20), emailCobranca: z.string().trim().email(), telefone: z.string().trim().max(20).default("") }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const state = await submit(createCompany, { name: input.nome, document: input.documento, billingEmail: input.emailCobranca, phone: input.telefone });
    return { result: { cadastrada: true, link: state.href ?? "/empresas" }, summary: `Cadastrei ${input.nome}` };
  },
});

const editCompany = tool({
  name: "atualizar_empresa",
  area: "empresas",
  description: "Altera nome, CNPJ/CPF, e-mail de cobrança ou telefone de uma empresa (só equipe). Só o que for informado muda.",
  input: z.object({ companyId: id, nome: z.string().trim().min(1).max(160).optional(), documento: z.string().trim().min(11).max(20).optional(), emailCobranca: z.string().trim().email().optional(), telefone: z.string().trim().max(20).optional() }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const [c] = await db.select().from(companies).where(eq(companies.id, input.companyId));
    if (!c) throw new ToolError("Empresa não encontrada.");
    await submit(updateCompany, { id: c.id, name: input.nome ?? c.name, document: input.documento ?? c.document, billingEmail: input.emailCobranca ?? c.billingEmail, phone: input.telefone ?? c.phone ?? "" });
    return { result: { atualizada: true, link: `/empresas/${c.id}` }, summary: `Atualizei ${input.nome ?? c.name}` };
  },
});

const addBookmark = tool({
  name: "criar_bookmark",
  area: "bookmarks",
  description: "Guarda um link como bookmark, opcionalmente numa pasta e numa empresa (sem empresa, vai para o espaço da Anuntech, só equipe).",
  input: z.object({ titulo: z.string().trim().min(1).max(160), url: z.string().trim().url().max(2048), companyId: id.optional(), pastaId: id.optional() }),
  write: true,
  run: async (_ctx, input) => {
    const state = await submit(saveBookmark, { title: input.titulo, url: input.url, companyId: input.companyId ?? "", folderId: input.pastaId ?? "" });
    return { result: { criado: true, link: state.href ?? "/bookmarks" }, summary: `Guardei o bookmark "${input.titulo}"` };
  },
});

const addBookmarkFolder = tool({
  name: "criar_pasta_de_bookmarks",
  area: "bookmarks",
  description: "Cria uma pasta de bookmarks numa empresa (ou no espaço da Anuntech, só equipe).",
  input: z.object({ nome: z.string().trim().min(1).max(80), companyId: id.optional() }),
  write: true,
  run: async (_ctx, input) => {
    const state = await submit(createFolder, { name: input.nome, companyId: input.companyId ?? "", visibility: "company" });
    return { result: { criada: true, link: state.href ?? "/bookmarks" }, summary: `Criei a pasta "${input.nome}"` };
  },
});

const addCatalogItem = tool({
  name: "criar_item_do_catalogo",
  area: "produtos",
  description: "Cadastra um produto ou serviço no catálogo da Anuntech (só equipe), com preço padrão e intervalo opcionais.",
  input: z.object({
    tipo: z.enum(["product", "service"]),
    nome: z.string().trim().min(1).max(160),
    descricao: z.string().trim().max(3000).default(""),
    url: z.string().trim().url().max(2048).optional(),
    valorReais: z.number().positive().max(9999999.99).optional(),
    intervalo: z.enum(["monthly", "yearly"]).optional(),
  }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    await submit(saveCatalogItem, { id: "", kind: input.tipo, name: input.nome, description: input.descricao, url: input.url ?? "", amount: input.valorReais !== undefined ? reais(input.valorReais) : "", interval: input.intervalo ?? "" });
    return { result: { criado: true, link: "/configuracoes/catalogo" }, summary: `Cadastrei "${input.nome}" no catálogo` };
  },
});

const linkCatalogItem = tool({
  name: "vincular_item_do_catalogo",
  area: "produtos",
  description:
    "Vincula um produto ou serviço do catálogo a uma empresa com o preço dela (só equipe). cobranca 'none' só vincula; 'draft' também cria a recorrência em rascunho (nada é emitido). Ache o catalogItemId com listar_catalogo.",
  input: z.object({ companyId: id, catalogItemId: id, valorReais: z.number().positive().max(9999999.99), intervalo: z.enum(["monthly", "yearly"]).default("monthly"), cobranca: z.enum(["none", "draft"]).default("none"), vencimento: z.iso.date().optional() }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const state = await submit(addCatalogEngagement, { companyId: input.companyId, catalogItemId: input.catalogItemId, amount: reais(input.valorReais), interval: input.intervalo, billing: input.cobranca, dueDate: input.vencimento ?? "" });
    return { result: { vinculado: true, link: state.href ?? "/produtos" }, summary: "Vinculei o item do catálogo" };
  },
});

const draftContract = tool({
  name: "criar_contrato_rascunho",
  area: "contratos",
  description: "Cria um contrato em rascunho para uma empresa a partir de um modelo (só equipe; ache o templateId com listar_modelos_de_contrato). O texto é revisado e enviado para assinatura na tela.",
  input: z.object({ companyId: id, templateId: id.optional(), engagementId: id.optional(), titulo: z.string().trim().max(160).optional() }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const state = await submit(createContract, { companyId: input.companyId, templateId: input.templateId ?? "", engagementId: input.engagementId ?? "", title: input.titulo ?? "" });
    return { result: { criado: true, rascunho: true, link: state.href ?? "/contratos", proximoPasso: "Revisar o texto e enviar para assinatura na tela." }, summary: "Criei o rascunho do contrato" };
  },
});

const contractTerm = tool({
  name: "definir_vigencia_contrato",
  area: "contratos",
  description: "Define ou ajusta início e fim da vigência de um contrato (só equipe); o alerta de vencimento segue essas datas.",
  input: z.object({ contratoId: id, inicio: civilDate.optional(), fim: civilDate.optional() }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const [c] = await db.select({ startsAt: contracts.startsAt, endsAt: contracts.endsAt, title: contracts.title }).from(contracts).where(eq(contracts.id, input.contratoId));
    if (!c) throw new ToolError("Contrato não encontrado.");
    await submit(setContractTerm, { id: input.contratoId, startsAt: input.inicio ?? c.startsAt ?? "", endsAt: input.fim ?? c.endsAt ?? "" });
    return { result: { atualizado: true, link: `/contratos/${input.contratoId}` }, summary: `Ajustei a vigência de "${c.title}"` };
  },
});

const editQuote = tool({
  name: "atualizar_orcamento",
  area: "orcamentos",
  description: "Altera um orçamento em rascunho (só equipe): título, resumo, taxa/hora, entrada, validade, stack, observações ou as fases inteiras. Só o que for informado muda.",
  input: z.object({
    orcamentoId: id,
    titulo: z.string().trim().min(1).max(160).optional(),
    resumo: z.string().trim().max(4000).optional(),
    taxaHoraReais: z.number().min(0).max(100000).optional(),
    entradaPercentual: z.number().int().min(0).max(100).optional(),
    validoAte: civilDate.optional(),
    stack: z.array(z.string().trim().min(1).max(160)).max(40).optional(),
    observacoes: z.string().trim().max(4000).optional(),
    fases: z
      .array(z.object({ nome: z.string().trim().min(1).max(160), descricao: z.string().trim().max(4000).default(""), horasMin: z.number().min(0), horasMax: z.number().min(0), tarefas: z.array(z.object({ titulo: z.string().trim().min(1).max(160), descricao: z.string().trim().max(4000).default("") })).default([]) }))
      .max(60)
      .optional(),
  }),
  staffOnly: true,
  write: true,
  run: async (_ctx, input) => {
    const [q] = await db.select().from(quotes).where(eq(quotes.id, input.orcamentoId));
    if (!q) throw new ToolError("Orçamento não encontrado.");
    if (q.status !== "draft") throw new ToolError("Só rascunhos podem ser alterados; volte o orçamento para rascunho na tela primeiro.");
    const content: QuoteContent = {
      summary: input.resumo ?? q.content.summary,
      stack: input.stack ?? q.content.stack,
      phases: input.fases
        ? input.fases.map((f) => ({ name: f.nome, description: f.descricao, hoursMin: Math.round(f.horasMin), hoursMax: Math.max(Math.round(f.horasMin), Math.round(f.horasMax)), tasks: f.tarefas.map((t) => ({ title: t.titulo, description: t.descricao })) }))
        : q.content.phases,
      hourlyRateCents: input.taxaHoraReais !== undefined ? Math.round(input.taxaHoraReais * 100) : q.content.hourlyRateCents,
      upfrontPercent: input.entradaPercentual ?? q.content.upfrontPercent,
      notes: input.observacoes ?? q.content.notes,
    };
    await submit(saveQuote, { id: q.id, revision: String(q.revision), title: input.titulo ?? q.title, validUntil: input.validoAte ?? q.validUntil ?? "", content: JSON.stringify(content) });
    const totals = quoteTotals(content);
    return { result: { atualizado: true, valorTotal: currency(totals.totalCents), link: `/orcamentos/${q.id}` }, summary: `Atualizei o orçamento "${input.titulo ?? q.title}"` };
  },
});

const cloneQuote = tool({
  name: "duplicar_orcamento",
  area: "orcamentos",
  description: "Duplica um orçamento como novo rascunho para a mesma empresa (só equipe). Para outra empresa, use criar_orcamento com copiarDeOrcamentoId.",
  input: z.object({ orcamentoId: id }),
  staffOnly: true,
  write: true,
  run: async (_ctx, { orcamentoId }) => {
    const state = await submit(duplicateQuote, { id: orcamentoId });
    return { result: { criado: true, link: state.href ?? "/orcamentos" }, summary: "Dupliquei o orçamento" };
  },
});

const inviteMember = tool({
  name: "convidar_membro",
  area: "empresas",
  description: "Dá acesso a uma pessoa numa empresa, como gestor (tudo, inclusive financeiro) ou membro (visão geral e chamados). Para gestores da empresa e equipe. Confirme e-mail e papel antes.",
  input: z.object({ companyId: id, email: z.string().trim().email(), papel: z.enum(["manager", "member"]) }),
  write: true,
  run: async ({ actor }, input) => {
    if (!managerOf(actor, input.companyId)) throw new ToolError("Só gestores da empresa ou a equipe da Anuntech dão acesso.");
    await submit(saveCompanyMember, { companyId: input.companyId, email: input.email, role: input.papel });
    return { result: { convidado: true, link: "/configuracoes/membros" }, summary: `Dei acesso a ${input.email} como ${roleLabels[input.papel] ?? input.papel}` };
  },
});

/** Search helper shared by name-based lookups: exact, then contains. */
export const bestMatch = <T extends { name: string }>(items: T[], wanted: string) => {
  const w = fold(wanted);
  return items.find((i) => fold(i.name) === w) ?? items.find((i) => fold(i.name).includes(w)) ?? null;
};

export const extraTools = [
  readCompany,
  readProject,
  readTask,
  readInvoice,
  listSubscriptions,
  listBookmarks,
  listCatalog,
  listContractTemplates,
  listBillingNotices,
  myAccount,
  editTask,
  removeTask,
  commentTask,
  editComment,
  uncommentTask,
  editProject,
  editTicket,
  draftInvoice,
  editDraftInvoice,
  dropDraftInvoice,
  addCompany,
  editCompany,
  addBookmark,
  addBookmarkFolder,
  addCatalogItem,
  linkCatalogItem,
  draftContract,
  contractTerm,
  editQuote,
  cloneQuote,
  inviteMember,
];
