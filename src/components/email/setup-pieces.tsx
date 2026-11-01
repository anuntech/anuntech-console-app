import Link from "next/link";
import { ChevronRightIcon, HourglassIcon, TriangleAlertIcon } from "lucide-react";
import { relativeLabel } from "@/lib/format";
import { HelpLink } from "@/components/console/help-link";

/** The help article with the DNS step by step for each provider. */
export const DOMAIN_HELP = "adicionar-dominio-de-email";

export const claimPage = (domain: string, companyId: string) => `/email/dns?dominio=${encodeURIComponent(domain)}&empresa=${companyId}`;

/** The company's domains still waiting for the proof, each one opening its step. */
export function PendingDomains({ claims }: { claims: { domain: string; companyId: string; createdAt: Date }[] }) {
  if (!claims.length) return null;
  return (
    <section aria-label="Domínios esperando a confirmação" className="mb-4 overflow-hidden rounded-xl border bg-card shadow-card">
      <ul className="divide-y">
        {claims.map((claim) => (
          <li key={claim.domain}>
            <Link href={claimPage(claim.domain, claim.companyId)} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
              <HourglassIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{claim.domain}</span>
                <span className="block text-xs text-muted-foreground">Esperando a prova de posse · adicionado {relativeLabel(claim.createdAt)}</span>
              </span>
              <span className="shrink-0 text-sm font-medium text-primary">Continuar</span>
              <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** While the mail still lands at the old provider: say so before anyone switches the MX. */
export function ArrivalNotice({ domain }: { domain: string }) {
  return (
    <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-warning-edge bg-warning-soft px-4 py-3 text-sm text-warning">
      <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        Os e-mails de {domain} ainda chegam no provedor antigo. As caixas daqui já funcionam, mas só recebem depois da troca do MX. Se a empresa já usa e-mail, peça à equipe da Anuntech para copiar as mensagens antigas antes de trocar.
      </p>
    </div>
  );
}

/** Where the records go in the panels clients use most; the help article has the rest. */
export function ProviderTips() {
  const tips = [
    ["Cloudflare", "DNS › Registros › Adicionar registro. Nos CNAME, deixe o proxy desligado (nuvem cinza)."],
    ["Registro.br", "Domínio › DNS › Editar zona (no modo avançado, quando o DNS é do próprio Registro.br)."],
    ["GoDaddy", "Meus produtos › Domínio › DNS › Adicionar novo registro."],
    ["Hostinger", "Domínios › DNS / Nameservers › Gerenciar registros DNS."],
  ];
  return (
    <section aria-labelledby="dns-tips" className="mt-6 rounded-xl border bg-card px-5 py-4 shadow-card">
      <h2 id="dns-tips" className="text-body-sm font-medium text-foreground">
        Onde criar os registros
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Na maioria dos painéis, o campo Nome leva só a parte antes do domínio (como aparece em &quot;Nome no painel&quot;), e @ quer dizer o próprio domínio. A mudança pode levar de alguns minutos a algumas horas para aparecer.
      </p>
      <dl className="mt-3 grid gap-2 text-sm">
        {tips.map(([name, where]) => (
          <div key={name} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
            <dt className="font-medium text-foreground">{name}</dt>
            <dd className="text-muted-foreground">{where}</dd>
          </div>
        ))}
      </dl>
      <HelpLink slug={DOMAIN_HELP} className="mt-3">
        Passo a passo na Ajuda
      </HelpLink>
    </section>
  );
}
