"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Building2Icon,
  HeadsetIcon,
  MoreHorizontalIcon,
  ReceiptTextIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/console/page-header";
import { Fact } from "@/components/console/fact";
import { ProductIcon } from "@/components/console/product-icon";
import { EngagementStatusBadge } from "@/components/projetos/project-badges";
import { DeleteEngagementDialog } from "@/components/projetos/delete-engagement-dialog";
import { currency, dateLabel } from "@/lib/format";
import { canDeleteEngagement, type EngagementLinks } from "@/lib/deletion-rules";

export type ServiceDetailData = {
  service: {
    id: string;
    name: string;
    status: string;
    description: string | null;
    companyId: string;
    company: string;
    /** The catalog item's icon, or null for initials. */
    icon: string | null;
    /** Present only for viewers who see money (the team and the company's Administradores). */
    billing?: {
      amountCents: number | null;
      interval: "monthly" | "yearly" | null;
      nextDueDate: string | null;
    };
    /** Staff only: what points at it, so "Excluir" shows only when it can go. */
    links?: EngagementLinks;
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

/** What a contracted service is, in the four fixed sections, plus its billing for those who see money. */
export function ServiceDetail({ data }: { data: ServiceDetailData }) {
  const { service, sections, viewer } = data;
  const billing = service.billing;
  const filled = SECTIONS.filter(([key]) => sections[key]);
  const [deleting, setDeleting] = useState(false);
  const deletable = viewer.admin && canDeleteEngagement(service.links);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Produtos e serviços", href: "/produtos" }, { label: service.name }]}
        title={service.name}
        leading={<ProductIcon src={service.icon} name={service.name} size={44} />}
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
            {service.description && <span>{service.description}</span>}
          </span>
        }
        actions={
          viewer.admin ? (
            <>
              <Button variant="outline" asChild>
                <Link href={`/empresas/${service.companyId}`}>
                  <Building2Icon />
                  Ver empresa
                </Link>
              </Button>
              {deletable && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Mais ações">
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setTimeout(() => setDeleting(true), 0)}
                    >
                      <Trash2Icon />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
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
      <div className={cn("grid gap-6 lg:items-start", billing && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
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
            <Card className="py-0">
              <EmptyState
                art="projetos"
                size="compact"
                title={
                  viewer.admin
                    ? "Este serviço ainda não tem os detalhes preenchidos no catálogo."
                    : "Os detalhes deste serviço serão publicados em breve."
                }
              />
            </Card>
          )}
        </div>
        {billing && (
          <aside className="flex min-w-0 flex-col gap-6">
            <Card variant="quiet">
              <CardHeader>
                <SectionTitle title="Cobrança" />
              </CardHeader>
              <CardContent>
                {billing.amountCents != null ? (
                  <dl className="grid gap-4">
                    <Fact label="Valor">
                      {currency(billing.amountCents)}
                      {billing.interval && (
                        <span className="text-muted-foreground"> {intervalLabel[billing.interval]}</span>
                      )}
                    </Fact>
                    {billing.nextDueDate && (
                      <Fact label="Próximo vencimento">{dateLabel(billing.nextDueDate)}</Fact>
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
        )}
      </div>
      {deletable && (
        <DeleteEngagementDialog
          engagement={{ id: service.id, name: service.name, kind: "service" }}
          open={deleting}
          onOpenChange={setDeleting}
        />
      )}
    </>
  );
}
