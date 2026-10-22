import Link from "next/link";
import { CalendarClockIcon, TriangleAlertIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { currency, dateLabel } from "@/lib/format";
import type { UpcomingCharge } from "@/lib/billing/upcoming-charges";
import { companyDisplayName } from "@/lib/companies/display-name";

const SHOWN = 4;

function Row({ charge, showCompany }: { charge: UpcomingCharge; showCompany: boolean }) {
  const paused = charge.status === "paused";
  // An active recurrence with a reason on it (the early issue did not go out, or the record will make it fail); the team only sees reasons.
  const warn = paused || !!charge.lastError || !!charge.problems;
  const title = (
    <>
      <span className="block truncate font-medium text-foreground">{charge.description}</span>
      {showCompany && (
        <span className="block truncate text-xs text-muted-foreground">
          {companyDisplayName(charge.company, charge.companyDocument)}
        </span>
      )}
    </>
  );
  return (
    <li className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0">
      {warn ? (
        <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      ) : (
        <CalendarClockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        {charge.invoiceId ? (
          <Link href={`/financeiro/${charge.invoiceId}`} className="block min-w-0 hover:[&_span:first-child]:text-primary">
            {title}
          </Link>
        ) : (
          title
        )}
        <span className={warn ? "mt-0.5 block text-xs text-warning" : "mt-0.5 block text-xs text-muted-foreground"}>
          {paused
            ? `Pausada. Não sai até ser retomada.${charge.lastError ? ` ${charge.lastError}` : ""}`
            : charge.problems
              ? `A emissão vai falhar: ${charge.problems}.`
              : (charge.lastError ??
              // With the switch on it may come sooner (the previous one paid); never later.
              `Boleto e Pix chegam até ${dateLabel(charge.issueDate)}.`)}
        </span>
        {charge.problems && (
          <Link href={`/empresas/${charge.companyId}?editar=1`} className="mt-0.5 inline-block text-xs font-medium text-primary hover:underline">
            Corrigir o cadastro
          </Link>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className="block font-medium tabular-nums text-foreground">{currency(charge.amountCents)}</span>
        <span className="block text-xs tabular-nums text-muted-foreground">vence {dateLabel(charge.dueDate)}</span>
      </div>
    </li>
  );
}

/**
 * What each recurrence charges next, before the invoice exists. The client
 * sees all of theirs ("Próximas cobranças"). The team sees only the ones
 * that need someone, paused or about to fail, and nothing when every
 * recurrence will go out on its own. The first few are open; the rest fold away.
 */
export function UpcomingCharges({ charges, showCompany, team }: { charges: UpcomingCharge[]; showCompany: boolean; team: boolean }) {
  const paused = charges.filter((c) => c.status === "paused");
  const failing = charges.filter((c) => c.status !== "paused" && (c.lastError || c.problems));
  const ordered = team ? [...paused, ...failing] : charges;
  if (!ordered.length) return null;
  const first = ordered.slice(0, SHOWN);
  const rest = ordered.slice(SHOWN);
  return (
    <Card className="mb-4 gap-4 py-5">
      <CardHeader>
        <SectionTitle
          title={team ? "Recorrências para corrigir" : "Próximas cobranças"}
          description={
            !team
              ? "Você recebe o aviso por e-mail e WhatsApp 5 dias antes de cada vencimento."
              : // Each row says what is wrong; the subtitle only says why the others are not here.
                "As demais saem sozinhas, com o aviso ao cliente 5 dias antes do vencimento."
          }
        />
      </CardHeader>
      <CardContent>
        <ul className="m-0 list-none divide-y p-0">
          {first.map((charge) => (
            <Row key={charge.subscriptionId} charge={charge} showCompany={showCompany} />
          ))}
        </ul>
        {rest.length > 0 && (
          <details className="group mt-3 border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium text-primary marker:content-none group-open:mb-3">
              <span className="group-open:hidden">Ver mais {rest.length}</span>
              <span className="hidden group-open:inline">Ver menos</span>
            </summary>
            <ul className="m-0 list-none divide-y p-0">
              {rest.map((charge) => (
                <Row key={charge.subscriptionId} charge={charge} showCompany={showCompany} />
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
