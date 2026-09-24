import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  CalendarClockIcon,
  CircleCheckIcon,
  Clock3Icon,
  MailCheckIcon,
  PlusIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { CompaniesTable } from "@/components/empresas/companies-table";
import { NewCompanyButton } from "@/components/empresas/company-sheet";
import { CompanyDetail } from "@/components/empresas/company-detail";
import {
  TicketsTable,
  type TicketRow,
} from "@/components/chamados/tickets-table";
import {
  TicketDetail,
  type TicketDetailData,
} from "@/components/chamados/ticket-detail";
import { NewTicketForm } from "@/components/chamados/ticket-form";
import { InvoiceMetrics } from "@/components/financeiro/invoice-metrics";
import {
  InvoicesTable,
  type InvoiceRow,
} from "@/components/financeiro/invoices-table";
import {
  InvoiceDetail,
  type InvoiceDetailData,
} from "@/components/financeiro/invoice-detail";
import { NewInvoiceForm } from "@/components/financeiro/invoice-form";
import { PaymentView } from "@/components/pagar/payment-view";
import { ProjectsList } from "@/components/projetos/projects-list";
import { ProjectBoard } from "@/components/projetos/project-board";
import { NewProjectForm } from "@/components/projetos/project-form";
import { BookmarksView } from "@/components/bookmarks/bookmarks-view";
import { ProductsList } from "@/components/produtos/products-list";
import { ServiceDetail } from "@/components/produtos/service-detail";
import { ContractsTable } from "@/components/contratos/contracts-table";
import { ContractDetail } from "@/components/contratos/contract-detail";
import { AuthShell } from "@/components/auth/auth-shell";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { SettingsNav } from "@/components/settings/settings-nav";
import {
  BellIcon,
  Building2Icon,
  PaletteIcon,
  PlugZapIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { AuthAlert } from "@/components/auth/feedback";
import { LoginForm } from "@/components/auth/login-form";
import QRCode from "qrcode";
import { invoiceListHref } from "@/lib/invoice-table";
import { saoPauloDate } from "@/lib/dates";

const SCREENS = [
  "lista",
  "detalhe",
  "vazio",
  "chamados",
  "chamados-vazio",
  "chamado",
  "chamado-cliente",
  "chamado-encerrado",
  "novo-chamado",
  "faturas",
  "faturas-periodo",
  "faturas-vazio",
  "fatura",
  "fatura-processando",
  "fatura-rascunho",
  "fatura-recorrente",
  "fatura-paga",
  "fatura-cliente",
  "nova-cobranca",
  "pagamento",
  "pagamento-vencida",
  "pagamento-processando",
  "pagamento-paga",
  "login",
  "login-erro",
  "login-codigo",
  "config",
  "projetos",
  "projetos-vazio",
  "projeto",
  "projeto-cliente",
  "novo-projeto",
  "bookmarks",
  "bookmarks-vazio",
  "produtos",
  "produtos-busca",
  "servico",
  "contratos",
  "contrato",
  "contrato-assinar",
  "contrato-assinado",
];

/**
 * Design preview with fixtures, for iterating on screens without a database.
 * Development only — production answers 404.
 */
export default async function Preview({
  searchParams,
}: {
  searchParams: Promise<{ tela?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tela = "lista" } = await searchParams;
  const now = new Date();
  const today = saoPauloDate(now);
  const ago = (hours: number) =>
    new Date(now.getTime() - hours * 3600_000).toISOString();
  const day = (offset: number) =>
    saoPauloDate(new Date(now.getTime() + offset * 86_400_000));
  const rows = [
    {
      id: "a1",
      name: "Maxipark Estacionamentos",
      document: "12345678000190",
      billingEmail: "financeiro@maxipark.com.br",
      phone: "11998877665",
      billingAddress: null,
      autoIssueNfse: false,
      archived: false,
      people: 3,
      openTickets: 2,
    },
    {
      id: "a2",
      name: "Paróquia Santa Rita",
      document: "98765432000101",
      billingEmail: "paroquia.santarita@yahoo.com.br",
      phone: "1133445566",
      billingAddress: null,
      autoIssueNfse: false,
      archived: false,
      people: 1,
      openTickets: 0,
    },
    {
      id: "a3",
      name: "Clínica Vida Plena",
      document: "11222333000144",
      billingEmail: "contato@vidaplena.med.br",
      phone: null,
      billingAddress: null,
      autoIssueNfse: false,
      archived: false,
      people: 0,
      openTickets: 1,
    },
    {
      id: "a4",
      name: "Padaria do Bairro Ltda",
      document: "55666777000188",
      billingEmail: "padaria@bairro.com",
      phone: "11955554444",
      billingAddress: null,
      autoIssueNfse: false,
      archived: true,
      people: 2,
      openTickets: 0,
    },
    {
      id: "a5",
      name: "Instituto Horizonte de Educação e Cultura",
      document: "33444555000166",
      billingEmail: "adm@horizonte.org.br",
      phone: "2133221100",
      billingAddress: null,
      autoIssueNfse: false,
      archived: false,
      people: 5,
      openTickets: 4,
    },
  ];
  const detail = {
    company: {
      id: "a1",
      name: "Maxipark Estacionamentos",
      document: "12345678000190",
      billingEmail: "financeiro@maxipark.com.br",
      phone: "11998877665",
      billingAddress: {
        cep: "01310-100",
        endereco: "Avenida Paulista",
        numero: "1578",
        complemento: "Conj. 1201",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        uf: "SP" as const,
        codigoMunicipio: "3550308",
      },
      autoIssueNfse: true,
      archived: false,
      createdAt: "2026-03-12",
    },
    members: [
      {
        id: "m1",
        email: "alexandre@maxipark.com.br",
        name: "Alexandre Souza",
        role: "manager",
        verified: true,
      },
      {
        id: "m2",
        email: "financeiro@maxipark.com.br",
        name: null,
        role: "member",
        verified: false,
      },
      {
        id: "m3",
        email: "ops@maxipark.com.br",
        name: "Carla Nunes",
        role: "member",
        verified: true,
      },
    ],
    events: [
      { id: "e1", action: "membership.granted", createdAt: "2026-09-20" },
      { id: "e2", action: "invoice.bank_accepted", createdAt: "2026-09-15" },
      { id: "e3", action: "company.updated", createdAt: "2026-08-02" },
      { id: "e4", action: "company.created", createdAt: "2026-03-12" },
    ],
    relations: {
      openTickets: 2,
      openInvoices: 1,
      openInvoicesCents: 189000,
      contracts: 2,
      engagements: 3,
    },
    links: {
      tickets: "/chamados?company=a1",
      invoices: "/financeiro?company=a1",
      contracts: "/contratos",
      engagements: "/produtos",
    },
  };
  const tickets: TicketRow[] = [
    {
      id: "t1",
      subject: "Nota fiscal de setembro não chegou",
      status: "open",
      priority: "high",
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      engagement: "Site institucional",
      author: "Alexandre Souza",
      assignedTo: null,
      updatedAt: ago(0.5),
    },
    {
      id: "t2",
      subject: "Alterar horário de funcionamento no site",
      status: "in_progress",
      priority: "normal",
      companyId: "a2",
      company: "Paróquia Santa Rita",
      engagement: null,
      author: "Marcos Vieira",
      assignedTo: "kauan@anuntech.com",
      updatedAt: ago(3),
    },
    {
      id: "t3",
      subject: "Erro ao emitir boleto pelo painel do aluno",
      status: "waiting_customer",
      priority: "normal",
      companyId: "a5",
      company: "Instituto Horizonte de Educação e Cultura",
      engagement: "Portal do aluno",
      author: "Renata Lima",
      assignedTo: "kauan@anuntech.com",
      updatedAt: ago(26),
    },
    {
      id: "t4",
      subject: "Acesso para nova pessoa do financeiro",
      status: "resolved",
      priority: "normal",
      companyId: "a3",
      company: "Clínica Vida Plena",
      engagement: null,
      author: "Paula Andrade",
      assignedTo: "kauan@anuntech.com",
      updatedAt: ago(24 * 3),
    },
    {
      id: "t5",
      subject: "Dúvida sobre o contrato de manutenção",
      status: "closed",
      priority: "normal",
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      engagement: null,
      author: "Carla Nunes",
      assignedTo: null,
      updatedAt: ago(24 * 20),
    },
  ];
  const file = {
    id: "f1",
    name: "comprovante-setembro.pdf",
    size: 184320,
    mime: "application/pdf",
    createdAt: ago(30),
    author: "Alexandre Souza",
  };
  const screenshot = {
    id: "f2",
    name: "erro-emissao.webp",
    size: 612000,
    mime: "image/webp",
    createdAt: ago(5),
    author: "Kauan Ketner",
  };
  const ticket: TicketDetailData = {
    ticket: {
      id: "t1",
      subject: "Nota fiscal de setembro não chegou",
      status: tela === "chamado-encerrado" ? "closed" : "open",
      priority: "high",
      assignedTo: tela === "chamado-cliente" ? "kauan@anuntech.com" : null,
      createdAt: ago(30),
      updatedAt: ago(0.5),
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      engagement: "Site institucional",
      author: { name: "Alexandre Souza", email: "alexandre@maxipark.com.br" },
    },
    entries: [
      {
        kind: "message",
        id: "m1",
        body: "Olá! A nota fiscal referente à mensalidade de setembro não chegou no e-mail do financeiro.\n\nO boleto foi pago no dia 10. Podem verificar?",
        createdAt: ago(30),
        author: "Alexandre Souza",
        staff: false,
      },
      { kind: "file", file, staff: false },
      {
        kind: "message",
        id: "m2",
        body: "Oi, Alexandre. Já localizei o pagamento. A NFS-e foi emitida, mas o e-mail voltou; vou reenviar para financeiro@maxipark.com.br e aviso aqui assim que sair.",
        createdAt: ago(5),
        author: "Kauan Ketner",
        staff: true,
      },
      { kind: "file", file: screenshot, staff: true },
      {
        kind: "message",
        id: "m3",
        body: "Perfeito, obrigado!",
        createdAt: ago(0.5),
        author: "Alexandre Souza",
        staff: false,
      },
    ],
    files: [file, screenshot],
    viewer: { admin: tela !== "chamado-cliente" },
    now: now.toISOString(),
  };
  const companies = rows
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name }));
  const engagements = [
    { id: "g1", name: "Site institucional", companyId: "a1" },
    { id: "g2", name: "Manutenção mensal", companyId: "a1" },
    { id: "g3", name: "Portal do aluno", companyId: "a5" },
  ];
  const invoiceRows: InvoiceRow[] = [
    {
      id: "i1",
      description: "Manutenção mensal — outubro",
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      amountCents: 189000,
      status: "issued",
      display: "issued",
      dueDate: day(12),
      recurring: true,
      interval: "monthly",
      publicUrl: "https://console.anuntech.com/pagar/abc",
      terms: { discountCents: 15000, fineBps: 200, interestMonthlyBps: 100 },
      editable: "issued",
      cancellable: false,
    },
    {
      id: "i2",
      description: "Hospedagem anual do site",
      companyId: "a2",
      company: "Paróquia Santa Rita",
      amountCents: 84000,
      status: "issued",
      display: "overdue",
      dueDate: day(-9),
      recurring: true,
      interval: "yearly",
      publicUrl: "https://console.anuntech.com/pagar/def",
      terms: { discountCents: 15000, fineBps: 200, interestMonthlyBps: 100 },
      editable: "issued",
      cancellable: false,
    },
    {
      id: "i3",
      description: "Portal do aluno — fase 2",
      companyId: "a5",
      company: "Instituto Horizonte de Educação e Cultura",
      amountCents: 1250000,
      status: "draft",
      display: "draft",
      dueDate: day(20),
      recurring: false,
      interval: null,
      publicUrl: null,
      terms: { discountCents: 15000, fineBps: 200, interestMonthlyBps: 100 },
      editable: "draft",
      cancellable: true,
    },
    {
      id: "i4",
      description: "Manutenção mensal — novembro",
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      amountCents: 189000,
      status: "draft",
      display: "scheduled",
      dueDate: day(42),
      recurring: true,
      interval: "monthly",
      publicUrl: null,
      terms: { discountCents: 15000, fineBps: 200, interestMonthlyBps: 100 },
      editable: null,
      cancellable: false,
    },
    {
      id: "i5",
      description: "Consultoria de agendamento online",
      companyId: "a3",
      company: "Clínica Vida Plena",
      amountCents: 450000,
      status: "paid",
      display: "paid",
      dueDate: day(-20),
      recurring: false,
      interval: null,
      publicUrl: "https://console.anuntech.com/pagar/ghi",
      terms: { discountCents: 15000, fineBps: 200, interestMonthlyBps: 100 },
      editable: null,
      cancellable: false,
    },
  ];
  const invoiceStatus =
    tela === "fatura-rascunho" || tela === "fatura-recorrente"
      ? "draft"
      : tela === "fatura-paga"
        ? "paid"
        : "issued";
  const processing = tela === "fatura-processando";
  const invoice: InvoiceDetailData = {
    invoice: {
      id: "i1",
      description: "Manutenção mensal — outubro",
      amountCents: 189000,
      dueDate: day(12),
      terms: { discountCents: 15000, fineBps: 200, interestMonthlyBps: 100 },
      status: invoiceStatus,
      display:
        invoiceStatus === "draft"
          ? tela === "fatura-recorrente"
            ? "scheduled"
            : "draft"
          : invoiceStatus,
      createdAt: ago(24 * 4),
      engagement: "Manutenção mensal",
      providerId: invoiceStatus === "draft" ? null : "7f3e1b2c-0000-4000-8000-000000000001",
      bankStatus:
        invoiceStatus === "draft"
          ? null
          : processing
            ? "EM_PROCESSAMENTO"
            : invoiceStatus === "paid"
              ? "RECEBIDO"
              : "A_RECEBER",
      bankCheckedAt: invoiceStatus === "draft" ? null : ago(0.05),
      bankRequested: invoiceStatus !== "draft",
      requestedDueDate: null,
      boletoLine:
        invoiceStatus === "issued" && !processing
          ? "07790000112345678901234567890123456789012345678"
          : null,
      pixCopyPaste:
        invoiceStatus === "issued" && !processing
          ? "00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d520400005303986540518.905802BR5913ANUNTECH LTDA6009SAO PAULO62070503***6304ABCD"
          : null,
      publicUrl:
        invoiceStatus === "draft" ? null : "https://console.anuntech.com/pagar/abc",
      publicEnabled: true,
      fiscalStatus: "not_requested",
      editable:
        invoiceStatus === "draft" && tela !== "fatura-recorrente"
          ? "draft"
          : invoiceStatus === "issued"
            ? "issued"
            : null,
    },
    company: {
      id: "a1",
      name: "Maxipark Estacionamentos",
      document: "12345678000190",
      address:
        "Avenida Paulista, 1578, Conj. 1201 — Bela Vista, São Paulo/SP — CEP 01310-100",
      autoIssueNfse: true,
    },
    subscription:
      tela === "fatura-rascunho" || tela === "fatura-cliente"
        ? null
        : {
            id: "s1",
            status: tela === "fatura-recorrente" ? "active" : "active",
            interval: "monthly",
            nextDueDate: day(42),
            issueDate: day(37),
            amountCents: 189000,
            description: "Manutenção mensal",
            lastError: null,
      terms: { discountCents: 15000, fineBps: 200, interestMonthlyBps: 100 },
          },
    scheduled: tela === "fatura-recorrente",
    scheduledIssueDate: tela === "fatura-recorrente" ? day(7) : null,
    notices:
      invoiceStatus === "draft" || processing
        ? []
        : [
            {
              id: "n1",
              channel: "email",
              kind: "initial",
              status: "delivered",
              error: null,
              createdAt: ago(24 * 4),
              resendable: false,
            },
            {
              id: "n2",
              channel: "whatsapp",
              kind: "initial",
              status: "failed",
              error: "Número sem WhatsApp ativo.",
              createdAt: ago(24 * 4),
              resendable: invoiceStatus === "issued",
            },
          ],
    contacts: {
      email: "financeiro@maxipark.com.br",
      emailEnabled: true,
      phone: "11998877665",
      whatsappEnabled: true,
    },
    canSend: { email: false, whatsapp: false },
    events: [
      { id: "e1", action: "invoice.bank_checked", createdAt: ago(0.05) },
      { id: "e2", action: "invoice.bank_accepted", createdAt: ago(24 * 2) },
      { id: "e3", action: "invoice.bank_requested", createdAt: ago(24 * 2) },
      { id: "e4", action: "invoice.bank_cancelled", createdAt: ago(24 * 2) },
      { id: "e5", action: "invoice.bank_checked", createdAt: ago(24 * 3) },
      { id: "e6", action: "invoice.bank_accepted", createdAt: ago(24 * 4) },
      { id: "e7", action: "invoice.bank_requested", createdAt: ago(24 * 4) },
      { id: "e8", action: "invoice.drafted", createdAt: ago(24 * 5) },
    ],
    viewer: { admin: tela !== "fatura-cliente" },
    sync: "off",
    today,
    now: now.toISOString(),
  };
  const pixPayload =
    "00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d520400005303986540527.005802BR5913ANUNTECH LTDA6009SAO PAULO62070503***6304ABCD";
  const invoiceQueryState = {
    status: "all" as const,
    search: "",
    company: "",
    period: tela === "faturas-periodo" ? ("custom" as const) : ("all" as const),
    from: tela === "faturas-periodo" ? day(-30) : "",
    to: "",
    page: 1,
    pageSize: 10,
  };
  const productRows = [
    {
      id: "pr1",
      kind: "product" as const,
      name: "Synova",
      status: "active",
      description: "Atendimento automático no WhatsApp com relatórios semanais.",
      url: "https://app.synova.com.br",
      amountCents: 29700,
      interval: "monthly" as const,
      nextDueDate: day(12),
      companyId: "a2",
      company: "Paróquia Santa Rita",
    },
    {
      id: "pr2",
      kind: "service" as const,
      name: "Gestão de tráfego",
      status: "active",
      description: "Campanhas no Google e Meta com relatório mensal.",
      url: null,
      amountCents: 150000,
      interval: "monthly" as const,
      nextDueDate: day(5),
      companyId: "a1",
      company: "Maxipark Estacionamentos",
    },
    {
      id: "pr3",
      kind: "product" as const,
      name: "Hospedagem do site",
      status: "paused",
      description: null,
      url: null,
      amountCents: null,
      interval: null,
      nextDueDate: null,
      companyId: "a3",
      company: "Instituto Vida Plena",
    },
  ];
  const projectRows = [
    {
      id: "p1",
      name: "Site institucional",
      status: "active",
      description:
        "Novo site com páginas de serviços, formulário de contato e integração com o WhatsApp.",
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      tasks: { total: 8, done: 3 },
    },
    {
      id: "p3",
      name: "Painel de reservas",
      status: "paused",
      description: null,
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      tasks: { total: 0, done: 0 },
    },
    {
      id: "p4",
      name: "Aplicativo de eventos",
      status: "completed",
      description: "Inscrições, check-in por QR code e envio de certificados.",
      companyId: "a3",
      company: "Instituto Vida Plena",
      tasks: { total: 21, done: 21 },
    },
  ];
  const person = (id: string, name: string) => ({ id, name, image: null as string | null });
  const boardPeople = [
    person("u1", "Kauan Ketner"),
    person("u2", "Alexandre Souza"),
    person("u3", "Mariana Lopes"),
    person("u4", "Beatriz Nunes"),
    person("u5", "Carlos Menezes"),
    person("u6", "Fernanda Prado"),
    person("u7", "Rafael Duarte"),
  ];
  const boardTask = (
    id: string,
    title: string,
    status: "backlog" | "todo" | "in_progress" | "review" | "done",
    extra: Partial<{
      priority: "low" | "normal" | "high" | "urgent";
      assignee: string;
      assignees: string[];
      dueDate: string;
      description: string;
      labels: string[];
      estimate: number;
      files: number;
    }> = {},
  ) => ({
    id,
    title,
    description: extra.description ?? null,
    status,
    priority: extra.priority ?? ("normal" as const),
    assignees: boardPeople.filter((p) =>
      [...(extra.assignees ?? []), ...(extra.assignee ? [extra.assignee] : [])].includes(p.name),
    ),
    dueDate: extra.dueDate ?? null,
    labels: extra.labels ?? [],
    estimateMinutes: extra.estimate ?? null,
    files: Array.from({ length: extra.files ?? 0 }, (_, i) => ({
      id: `${id}-f${i}`,
      name: i ? "referencia.pdf" : "layout-home.webp",
      size: i ? 184_000 : 412_000,
      mime: i ? "application/pdf" : "image/webp",
      authorId: "u1",
    })),
    createdBy: "u1",
    creator: "Kauan Ketner",
    updatedAt: ago(5),
  });
  const boardTasks = [
    boardTask("t1", "Levantar referências de sites do setor", "backlog", { priority: "low" }),
    boardTask("t2", "Definir a estrutura de páginas", "backlog", { assignee: "Kauan Ketner" }),
    boardTask("t3", "Escrever os textos das páginas de serviços", "todo", {
      assignee: "Alexandre Souza",
      dueDate: day(4),
      description: "Um parágrafo por serviço, com o diferencial e uma chamada para contato.",
      labels: ["Conteúdo"],
      estimate: 180,
    }),
    boardTask("t4", "Aprovar a paleta de cores com o cliente", "todo", {
      priority: "high",
      dueDate: day(-2),
      assignee: "Kauan Ketner",
    }),
    boardTask("t5", "Montar o layout da página inicial", "in_progress", {
      assignee: "Mariana Lopes",
      dueDate: day(0),
      labels: ["Design", "Home"],
      estimate: 480,
      files: 2,
    }),
    boardTask("t6", "Integrar o formulário de contato ao WhatsApp", "in_progress", {
      priority: "urgent",
      assignees: ["Kauan Ketner", "Mariana Lopes", "Alexandre Souza"],
      dueDate: day(1),
      labels: ["Integração", "WhatsApp", "Backend", "Urgente"],
      estimate: 90,
    }),
    boardTask("t7", "Revisar textos da página Sobre", "review", { assignee: "Alexandre Souza" }),
    boardTask("t8", "Registrar o domínio e apontar o DNS", "done", { dueDate: day(-10) }),
    boardTask("t9", "Configurar o ambiente de publicação", "done", { assignee: "Kauan Ketner" }),
  ];
  const board = {
    project: {
      id: "p1",
      name: "Site institucional",
      kind: "project" as const,
      status: "active",
      description:
        "Novo site com páginas de serviços, formulário de contato e integração com o WhatsApp.",
      companyId: "a1",
      company: "Maxipark Estacionamentos",
    },
    tasks: boardTasks,
    people: boardPeople,
    viewer: { id: "u1", admin: tela !== "projeto-cliente" },
    today,
    now: now.toISOString(),
  };
  const bookmarkFolders = [
    {
      id: "f1",
      name: "Referências de design",
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      ownerId: "u1",
      owner: "Kauan Ketner",
      visibility: "people" as const,
      sharedWith: [person("u2", "Alexandre Souza"), person("u3", "Mariana Lopes")],
      count: 4,
    },
    {
      id: "f2",
      name: "Fornecedores",
      companyId: null,
      company: null,
      ownerId: "u1",
      owner: "Kauan Ketner",
      visibility: "company" as const,
      sharedWith: [],
      count: 2,
    },
    {
      id: "f3",
      name: "Materiais Maxipark",
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      ownerId: "u2",
      owner: "Alexandre Souza",
      visibility: "company" as const,
      sharedWith: [],
      count: 2,
    },
  ];
  const bookmark = (id: string, title: string, url: string | null, folderId: string | null, fileName?: string) => ({
    id,
    title,
    url,
    fileName: fileName ?? null,
    folderId,
    companyId: folderId === "f2" || folderId === null ? null : "a1",
    ownerId: folderId === "f3" ? "u2" : "u1",
    createdAt: ago(3),
  });
  const bookmarkItems = [
    bookmark("b1", "Guia de componentes do shadcn", "https://ui.shadcn.com/docs/components", "f1"),
    bookmark("b2", "Paleta de cores da marca", "https://www.figma.com/file/abc/anuntech-brand", "f1"),
    bookmark("b3", "Ícones Lucide", "https://lucide.dev/icons", "f1"),
    bookmark("b4", "Dribbble: dashboards", "https://dribbble.com/tags/dashboard", "f1"),
    bookmark("b5", "Tabela de preços Resend", "https://resend.com/pricing", "f2"),
    bookmark("b6", "Contrato padrão do fornecedor", null, "f2", "contrato-fornecedor.pdf"),
    bookmark("b7", "Planilha de vagas do estacionamento", "https://docs.google.com/spreadsheets/d/xyz", "f3"),
    bookmark("b8", "Fotos das unidades", "https://drive.google.com/drive/folders/123", "f3"),
    bookmark("b9", "Documentação da API do Inter", "https://developers.inter.co/references/cobranca", null),
    bookmark("b10", "Painel da Vercel", "https://vercel.com/anuntech", null),
  ];
  const bookmarksData = {
    folders: bookmarkFolders,
    items: tela === "bookmarks-vazio" ? [] : bookmarkItems,
    query: { folder: "all", search: tela === "bookmarks-vazio" ? "zzz" : "", company: "all" },
    counts: { root: 2, total: 10 },
    companies: [
      { id: "", name: "Anuntech" },
      { id: "a1", name: "Maxipark Estacionamentos" },
      { id: "a2", name: "Paróquia Santa Rita" },
    ],
    viewer: { id: "u1", admin: true },
  };
  const contractRows = [
    {
      id: "c1",
      title: "Prestação de serviços — Maxipark Estacionamentos",
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      engagement: "Gestão de tráfego",
      status: "sent" as const,
      signedBy: ["anuntech" as const],
      updatedAt: ago(20),
    },
    {
      id: "c2",
      title: "Licença de uso do Synova — Paróquia Santa Rita",
      companyId: "a2",
      company: "Paróquia Santa Rita",
      engagement: "Synova",
      status: "signed" as const,
      signedBy: ["client" as const, "anuntech" as const],
      updatedAt: ago(70),
    },
    {
      id: "c3",
      title: "Desenvolvimento do site — Instituto Vida Plena",
      companyId: "a3",
      company: "Instituto Vida Plena",
      engagement: null,
      status: "draft" as const,
      signedBy: [],
      updatedAt: ago(2),
    },
  ];
  const contractBody = [
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    "CONTRATANTE: Maxipark Estacionamentos Ltda, CNPJ 12.345.678/0001-90, com sede na Avenida Paulista, 1578, São Paulo/SP.\nCONTRATADA: Anuntech Tecnologia Ltda, CNPJ 98.765.432/0001-10.",
    "CLÁUSULA 1 — OBJETO\nA CONTRATADA prestará o serviço de Gestão de tráfego, compreendendo o planejamento, a publicação e a otimização de campanhas de mídia paga.",
    "CLÁUSULA 2 — VALOR E PAGAMENTO\nPelos serviços, a CONTRATANTE pagará R$ 1.500,00 mensais, com vencimento todo dia 5, por boleto ou Pix emitidos pelo Console.",
    "CLÁUSULA 3 — VIGÊNCIA\nO presente contrato vigora por 12 meses a partir da assinatura, renovando-se automaticamente por iguais períodos salvo aviso com 30 dias de antecedência.",
    "CLÁUSULA 4 — RESCISÃO\nQualquer das partes pode rescindir mediante aviso prévio de 30 dias, sem multa, respeitados os valores devidos até a data.",
    "São Paulo, {{data}}.",
  ].join("\n\n");
  const contractStatus =
    tela === "contrato-assinado" ? ("signed" as const) : tela === "contrato-assinar" ? ("sent" as const) : ("draft" as const);
  const contractDetail = {
    contract: {
      id: "c1",
      title: "Prestação de serviços — Maxipark Estacionamentos",
      body: contractStatus === "draft" ? contractBody : contractBody.replace("{{data}}", "23 de setembro de 2026"),
      status: contractStatus,
      revision: 3,
      companyId: "a1",
      company: "Maxipark Estacionamentos",
      companyDocument: "12345678000190",
      engagement: "Gestão de tráfego",
      template: "Prestação de serviços",
      documentHash:
        contractStatus === "draft" ? null : "9f2c1e7b4d8a6c0e5b3a1f7d2c9e8b6a4d1f0c3e7a9b5d2f8c6e4a1b3d7f9e2c",
      sentAt: contractStatus === "draft" ? null : ago(30),
      signedAt: contractStatus === "signed" ? ago(1) : null,
      createdAt: ago(72),
      pendingVariables: contractStatus === "draft" ? ["{{data}}"] : [],
    },
    signatures:
      contractStatus === "draft"
        ? []
        : [
            { party: "anuntech" as const, name: "Kauan Ketner", email: "kauan@anuntech.com", signedAt: ago(28), ip: "177.10.20.30" },
            ...(contractStatus === "signed"
              ? [{ party: "client" as const, name: "Alexandre Souza", email: "alexandre@maxipark.com.br", signedAt: ago(1), ip: "189.40.50.60" }]
              : []),
          ],
    viewer:
      tela === "contrato-assinar"
        ? { admin: false, party: "client" as const, name: "Alexandre Souza" }
        : { admin: true, party: "anuntech" as const, name: "Kauan Ketner" },
    events:
      tela === "contrato-assinar"
        ? []
        : [
            { id: "e3", action: "contract.signed", createdAt: ago(28) },
            { id: "e2", action: "contract.sent", createdAt: ago(30) },
            { id: "e1", action: "contract.created", createdAt: ago(72) },
          ],
    now: now.toISOString(),
  };
  if (tela.startsWith("login"))
    return (
      <AuthShell
        eyebrow="Bem-vindo"
        title="Entre no Console"
        description="Use o e-mail que recebeu acesso à sua empresa."
      >
        <div className="flex flex-col gap-5">
          {tela === "login-erro" && (
            <AuthAlert kind="error">
              Não foi possível concluir o acesso. Confira se está usando o
              e-mail autorizado e tente novamente.
            </AuthAlert>
          )}
          <LoginForm
            preview={
              tela === "login-codigo"
                ? { destination: "alexandre@maxipark.com.br" }
                : undefined
            }
          />
          <p className="text-center text-xs text-muted-foreground">
            Ainda não tem acesso? Solicite a liberação à equipe da Anuntech.
          </p>
        </div>
      </AuthShell>
    );
  return (
    <main className="mx-auto w-full max-w-[1512px] px-9 py-8">
      <p className="mb-6 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        Preview ·
        {SCREENS.map((screen) => (
          <a
            key={screen}
            href={`?tela=${screen}`}
            className={screen === tela ? "font-semibold text-foreground" : ""}
          >
            {screen}
          </a>
        ))}
      </p>
      {tela === "detalhe" ? (
        <CompanyDetail data={detail} />
      ) : tela.startsWith("chamado-") || tela === "chamado" ? (
        tela === "chamados-vazio" ? null : (
          <TicketDetail data={ticket} />
        )
      ) : tela === "novo-chamado" ? (
        <>
          <PageHeader
            crumbs={[
              { label: "Chamados", href: "/chamados" },
              { label: "Abrir chamado" },
            ]}
            title="Abrir chamado"
            description="Como podemos ajudar?"
          />
          <NewTicketForm companies={companies} />
        </>
      ) : tela.startsWith("chamados") ? (
        <>
          <PageHeader
            title="Chamados"
            count={tela === "chamados-vazio" ? 0 : 5}
            description="Solicitações dos clientes e o andamento de cada conversa."
            actions={
              <Button asChild>
                <Link href="/chamados/novo">
                  <PlusIcon />
                  Abrir chamado
                </Link>
              </Button>
            }
          />
          <TicketsTable
            rows={tela === "chamados-vazio" ? [] : tickets}
            query={{
              status: "active",
              search: "",
              company: "",
              page: 1,
              pageSize: 25,
            }}
            total={tela === "chamados-vazio" ? 0 : 5}
            pageCount={1}
            now={now.toISOString()}
            admin
            showCompany
            canCreate
          />
        </>
      ) : tela.startsWith("bookmarks") ? (
        <BookmarksView data={bookmarksData} />
      ) : tela.startsWith("projeto-") || tela === "projeto" ? (
        <ProjectBoard data={board} />
      ) : tela === "novo-projeto" ? (
        <>
          <PageHeader
            crumbs={[{ label: "Projetos", href: "/projetos" }, { label: "Novo" }]}
            title="Novo projeto"
            description="O projeto fica vinculado à empresa e ganha um quadro de tarefas."
          />
          <NewProjectForm companies={companies} />
        </>
      ) : tela === "contratos" ? (
        <>
          <PageHeader
            title="Contratos"
            count={contractRows.length}
            description="Do modelo à assinatura das duas partes, com o PDF final guardado."
            actions={
              <Button asChild>
                <Link href="/contratos/novo">
                  <PlusIcon />
                  Novo contrato
                </Link>
              </Button>
            }
          />
          <ContractsTable
            rows={contractRows}
            query={{ status: "all", search: "", company: "" }}
            admin
            showCompany
            now={now.toISOString()}
          />
        </>
      ) : tela.startsWith("contrato") ? (
        <ContractDetail data={contractDetail} />
      ) : tela === "servico" ? (
        <ServiceDetail
          data={{
            service: {
              id: "pr2",
              name: "Gestão de tráfego",
              status: "active",
              description: "Campanhas no Google e Meta com relatório mensal.",
              companyId: "a1",
              company: "Maxipark Estacionamentos",
              amountCents: 150000,
              interval: "monthly",
              nextDueDate: day(5),
              subscriptionId: "s1",
            },
            sections: {
              whatWeDo:
                "Planejamos, publicamos e otimizamos campanhas de busca e social. Acompanhamos custo por lead toda semana e ajustamos verba entre canais.",
              whatWeNeed:
                "Acesso às contas de anúncios, catálogo de serviços com preços e um contato para aprovar criativos em até 2 dias úteis.",
              expectedResults:
                "Leads qualificados com custo abaixo de R$ 40 no terceiro mês e relatório mensal com o que foi aprendido.",
              deadlines: "Setup nas duas primeiras semanas. Relatório todo dia 5. Reunião de revisão a cada mês.",
            },
            viewer: { admin: true },
          }}
        />
      ) : tela === "produtos" || tela === "produtos-busca" ? (
        <>
          <PageHeader
            title="Produtos e serviços"
            count={productRows.length}
            description="O que cada cliente contratou. Produtos abrem pelo link; serviços têm uma página de detalhes."
            actions={
              <Button asChild>
                <Link href="/produtos/novo">
                  <PlusIcon />
                  Vincular
                </Link>
              </Button>
            }
          />
          <ProductsList
            rows={
              tela === "produtos-busca"
                ? productRows.filter((row) => /maxipark/i.test(row.company))
                : productRows
            }
            query={{ status: "active", search: tela === "produtos-busca" ? "maxi" : "", company: "" }}
            admin
            showCompany
          />
        </>
      ) : tela.startsWith("projetos") ? (
        <>
          <PageHeader
            title="Projetos"
            count={tela === "projetos-vazio" ? 0 : projectRows.length}
            description="O que está em andamento com cada cliente, com o quadro de tarefas de cada projeto."
            actions={
              <Button asChild>
                <Link href="/projetos/novo">
                  <PlusIcon />
                  Novo projeto
                </Link>
              </Button>
            }
          />
          <ProjectsList
            rows={tela === "projetos-vazio" ? [] : projectRows}
            query={{ status: "active", search: "", company: "" }}
            admin
            showCompany
          />
        </>
      ) : tela === "config" ? (
        <>
          <PageHeader
            crumbs={[{ label: "Configurações", href: "/conta" }, { label: "Aparência" }]}
            title="Aparência"
            description="Como o Console se apresenta para você, neste navegador."
          />
          <div className="grid gap-6 lg:grid-cols-[208px_minmax(0,1fr)] lg:items-start">
            <aside className="lg:sticky lg:top-6">
              <SettingsNav
                groups={[
                  {
                    title: "Conta",
                    items: [
                      { key: "account", href: "/conta", label: "Minha conta", icon: <UserRoundIcon /> },
                      { key: "security", href: "/configuracoes/seguranca", label: "Segurança", icon: <ShieldCheckIcon /> },
                      { key: "appearance", href: "/dev/preview", label: "Aparência", icon: <PaletteIcon /> },
                    ],
                  },
                  {
                    title: "Anuntech",
                    items: [
                      { key: "company", href: "/configuracoes/empresa", label: "Dados da empresa", icon: <Building2Icon /> },
                      { key: "members", href: "/configuracoes/membros", label: "Membros", icon: <UsersIcon /> },
                      { key: "notifications", href: "/configuracoes/notificacoes", label: "Notificações", icon: <BellIcon /> },
                    ],
                  },
                  {
                    title: "Console",
                    items: [
                      { key: "integrations", href: "/configuracoes/integracoes", label: "Integrações", icon: <PlugZapIcon /> },
                    ],
                  },
                ]}
              />
            </aside>
            <div className="flex min-w-0 flex-col gap-6">
              <AppearanceSection />
            </div>
          </div>
        </>
      ) : tela.startsWith("pagamento") ? (
        <PaymentView
          invoice={{
            description: "Parcela 8 — Robô + Banner",
            company: "Maxipark Estacionamentos Ltda",
            amountCents: 270000,
            dueDate: tela === "pagamento-vencida" ? day(-6) : day(12),
            status: tela === "pagamento-paga" ? "paid" : "issued",
            pix:
              tela === "pagamento-processando" || tela === "pagamento-paga"
                ? null
                : pixPayload,
            boletoLine:
              tela === "pagamento-processando" || tela === "pagamento-paga"
                ? null
                : "07790000112345678901234567890123456789012345678",
            terms: { discountCents: 15000, fineBps: 200, interestMonthlyBps: 100 },
          }}
          qr={
            tela === "pagamento-processando" || tela === "pagamento-paga"
              ? null
              : await QRCode.toDataURL(pixPayload, {
                  width: 256,
                  margin: 2,
                  errorCorrectionLevel: "M",
                })
          }
          publicId="preview"
          today={today}
        />
      ) : tela === "nova-cobranca" ? (
        <>
          <PageHeader
            crumbs={[
              { label: "Financeiro", href: "/financeiro" },
              { label: "Nova cobrança" },
            ]}
            title="Nova cobrança"
            description="Quem paga, o que está sendo cobrado e as condições."
          />
          <NewInvoiceForm companies={companies} engagements={engagements} />
        </>
      ) : tela.startsWith("fatura-") || tela === "fatura" ? (
        <InvoiceDetail data={invoice} />
      ) : tela.startsWith("faturas") ? (
        <>
          <PageHeader
            title="Faturas"
            count={tela === "faturas-vazio" ? 0 : 5}
            description="Cobranças de cada cliente: emissão no Inter, avisos e pagamento."
            actions={
              <>
                <Button variant="outline" asChild>
                  <Link href="/financeiro/envios">
                    <MailCheckIcon />
                    Envios
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/financeiro/nova">
                    <PlusIcon />
                    Nova cobrança
                  </Link>
                </Button>
              </>
            }
          />
          <InvoiceMetrics
            active="all"
            hrefFor={(status) =>
              invoiceListHref({ ...invoiceQueryState, status })
            }
            metrics={[
              {
                status: "issued",
                label: "Em aberto",
                count: 1,
                cents: 189000,
                icon: <Clock3Icon />,
              },
              {
                status: "overdue",
                label: "Vencidas",
                count: 1,
                cents: 84000,
                tone: "destructive",
                icon: <TriangleAlertIcon />,
              },
              {
                status: "scheduled",
                label: "Agendadas",
                count: 1,
                cents: 189000,
                icon: <CalendarClockIcon />,
              },
              {
                status: "paid",
                label: "Pagas",
                count: 1,
                cents: 450000,
                tone: "success",
                icon: <CircleCheckIcon />,
              },
            ]}
          />
          <InvoicesTable
            rows={tela === "faturas-vazio" ? [] : invoiceRows}
            query={invoiceQueryState}
            total={tela === "faturas-vazio" ? 0 : 5}
            pageCount={1}
            today={today}
            admin
            showCompany
          />
        </>
      ) : (
        <>
          <PageHeader
            title="Empresas"
            count={tela === "vazio" ? 0 : 34}
            description="Clientes, contatos financeiros e quem acessa o Console por eles."
            actions={
              <Suspense>
                <NewCompanyButton />
              </Suspense>
            }
          />
          <CompaniesTable
            rows={tela === "vazio" ? [] : rows}
            query={{
              status: "active",
              search: tela === "vazio" ? "zzz" : "",
              page: 1,
              pageSize: 10,
            }}
            total={tela === "vazio" ? 0 : 34}
            pageCount={tela === "vazio" ? 1 : 4}
          />
        </>
      )}
    </main>
  );
}
