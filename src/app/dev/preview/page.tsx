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
  "faturas-vazio",
  "fatura",
  "fatura-processando",
  "fatura-rascunho",
  "fatura-recorrente",
  "fatura-paga",
  "fatura-cliente",
  "nova-cobranca",
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
  const invoiceQueryState = {
    status: "all" as const,
    search: "",
    company: "",
    page: 1,
    pageSize: 10,
  };
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
