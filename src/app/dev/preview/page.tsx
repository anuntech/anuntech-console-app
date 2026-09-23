import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlusIcon } from "lucide-react";
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
  const ago = (hours: number) =>
    new Date(now.getTime() - hours * 3600_000).toISOString();
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
      invoices: "/financeiro",
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
