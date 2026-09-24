"use client";
import Link from "next/link";
import {
  Building2Icon,
  HeadsetIcon,
  ReceiptTextIcon,
  WrenchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/console/page-header";
import { Fact } from "@/components/console/fact";
import { EngagementStatusBadge } from "@/components/projetos/project-badges";
import { currency, dateLabel } from "@/lib/format";

export type ServiceDetailData = {
  service: {
    id: string;
    name: string;
    status: string;
    description: string | null;
    companyId: string;
    company: string;
    amountCents: number | null;
    interval: "monthly" | "yearly" | null;
    nextDueDate: string | null;
    subscriptionId: string | null;
  };
  sections: {
    whatWeDo: string | null;
    whatWeNeed: string | null;
    expectedResults: string | null;
    deadlines: string | null;
  };
  viewer: { admin: boolean };
};

const SECTIONS = [
  ["whatWeDo", "O que fazemos"],
  ["whatWeNeed", "O que precisamos de você"],
  ["expectedResults", "Resultados esperados"],
  ["deadlines", "Prazos"],
] as const;
const intervalLabel = { monthly: "por mês", yearly: "por ano" } as const;

/** What a contracted service is, in the four fixed sections, plus its billing. */
export function ServiceDetail({ data }: { data: ServiceDetailData }) {
  const { service, sections, viewer } = data;
  const filled = SECTIONS.filter(([key]) => sections[key]);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Produtos e serviços", href: "/produtos" }, { label: service.name }]}
        title={service.name}
        leading={
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary [&_svg]:size-5">
            <WrenchIcon />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <EngagementStatusBadge status={service.status} />
            {viewer.admin ? (
              <Link href={`/empresas/${service.companyId}`} className="text-foreground hover:text-primary">
                {service.company}
              </Link>
            ) : (
              <span>{service.company}</span>
            )}
            {service.description && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span>{service.description}</span>
              </>
            )}
          </span>
        }
        actions={
          viewer.admin ? (
            <Button variant="outline" asChild>
              <Link href={`/empresas/${service.companyId}`}>
                <Building2Icon />
                Ver empresa
              </Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href={`/chamados/novo?companyId=${service.companyId}`}>
                <HeadsetIcon />
                Abrir chamado
              </Link>
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {filled.length ? (
            filled.map(([key, title]) => (
              <Card key={key}>
                <CardHeader>
                  <SectionTitle title={title} />
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 whitespace-pre-wrap text-foreground">{sections[key]}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {viewer.admin
                  ? "Este serviço ainda não tem os detalhes preenchidos no catálogo."
                  : "Os detalhes deste serviço serão publicados em breve."}
              </CardContent>
            </Card>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle title="Cobrança" />
            </CardHeader>
            <CardContent>
              {service.amountCents != null ? (
                <dl className="grid gap-4">
                  <Fact label="Valor">
                    {currency(service.amountCents)}
                    {service.interval && (
                      <span className="text-muted-foreground"> {intervalLabel[service.interval]}</span>
                    )}
                  </Fact>
                  {service.nextDueDate && (
                    <Fact label="Próximo vencimento">{dateLabel(service.nextDueDate)}</Fact>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Sem cobrança vinculada.</p>
              )}
              {viewer.admin && (
                <Button variant="ghost" size="sm" className="mt-3 -ml-2" asChild>
                  <Link href={`/financeiro?company=${service.companyId}`}>
                    <ReceiptTextIcon />
                    Ver no Financeiro
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
