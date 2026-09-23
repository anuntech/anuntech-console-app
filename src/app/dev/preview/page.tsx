import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/console/page-header";
import { CompaniesTable } from "@/components/empresas/companies-table";
import { NewCompanyButton } from "@/components/empresas/company-sheet";
import { CompanyDetail } from "@/components/empresas/company-detail";

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
      tickets: "/chamados",
      invoices: "/financeiro",
      contracts: "/contratos",
      engagements: "/produtos",
    },
  };
  return (
    <main className="mx-auto w-full max-w-[1512px] px-9 py-8">
      <p className="mb-6 text-xs text-muted-foreground">
        Preview · <a href="?tela=lista">lista</a> ·{" "}
        <a href="?tela=detalhe">detalhe</a> · <a href="?tela=vazio">vazio</a>
      </p>
      {tela === "detalhe" ? (
        <CompanyDetail data={detail} />
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
