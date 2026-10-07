import Link from "next/link";
import { CalendarClockIcon, TriangleAlertIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { currency, dateLabel } from "@/lib/format";
import type { UpcomingCharge } from "@/lib/billing/upcoming-charges";

const SHOWN = 4;

function Row({ charge, showCompany }: { charge: UpcomingCharge; showCompany: boolean }) {
  const paused = charge.status === "paused";
  const title = (
    <>
      <span className="block truncate font-medium text-foreground">{charge.description}</span>
      {showCompany && <span className="block truncate text-xs text-muted-foreground">{charge.company}</span>}
    </>
  );
  return (
    <li className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0">
      {paused ? (
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
        <span className={paused ? "mt-0.5 block text-xs text-warning" : "mt-0.5 block text-xs text-muted-foreground"}>
          {paused
            ? `Pausada: não será emitida até ser retomada.${charge.lastError ? ` ${charge.lastError}` : ""}`
            : // With the switch on it may come sooner (the previous one paid); never later.
              `Boleto e Pix chegam até ${dateLabel(charge.issueDate)}.`}
        </span>
      </div>
      <div className="shrink-0 text-right">
        <span className="block font-medium tabular-nums text-foreground">{currency(charge.amountCents)}</span>
        <span className="block text-xs tabular-nums text-muted-foreground">vence {dateLabel(charge.dueDate)}</span>
      </div>
    </li>
  );
}

/**
 * "Próximas cobranças": what each recurrence charges next, before the
 * invoice exists. The first few are open; the rest fold away.
 */
export function UpcomingCharges({ charges, showCompany, team }: { charges: UpcomingCharge[]; showCompany: boolean; team: boolean }) {
  if (!charges.length) return null;
  const paused = charges.filter((c) => c.status === "paused");
  // Paused first: they are the ones that need someone.
  const ordered = [...paused, ...charges.filter((c) => c.status !== "paused")];
  const first = ordered.slice(0, SHOWN);
  const rest = ordered.slice(SHOWN);
  return (
    <Card className="mb-4 gap-4 py-5">
      <CardHeader>
        <SectionTitle
          title="Próximas cobranças"
          description={
            !team
              ? "Você recebe o aviso por e-mail e WhatsApp 5 dias antes de cada vencimento."
              : paused.length
                ? `${paused.length === 1 ? "1 recorrência pausada" : `${paused.length} recorrências pausadas`}. As demais são emitidas sozinhas, e o aviso ao cliente vai 5 dias antes do vencimento.`
                : "Emitidas sozinhas. O aviso ao cliente vai 5 dias antes do vencimento."
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
