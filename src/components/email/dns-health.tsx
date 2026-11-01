import { CircleCheckIcon, CircleHelpIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { CopyButton } from "@/components/console/copy-button";
import type { DnsCheck } from "@/lib/mail/mail-rules";

const STATUS = {
  ok: { label: "Certo", icon: CircleCheckIcon, pill: "border-success-edge bg-success-soft text-success" },
  missing: { label: "Falta isto", icon: TriangleAlertIcon, pill: "border-warning-edge bg-warning-soft text-warning" },
  unknown: { label: "Não deu para conferir", icon: CircleHelpIcon, pill: "border-border bg-secondary text-secondary-foreground" },
} as const;

function RecordLine({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-mono text-[13px] break-all text-foreground">{value}</p>
      </div>
      {copy && <CopyButton value={value} label={label} />}
    </div>
  );
}

/** One record of the domain: what it does, whether it is right and, when not, what to put in the DNS panel. */
function Check({ check }: { check: DnsCheck }) {
  const status = STATUS[check.status];
  const Icon = status.icon;
  return (
    <li className="grid gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-body-sm font-medium text-foreground">{check.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{check.purpose}</p>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", status.pill)}>
          <Icon aria-hidden="true" className="size-3.5" />
          {status.label}
        </span>
      </div>
      {check.status === "unknown" && (
        <p className="text-sm text-muted-foreground">A consulta ao DNS não respondeu agora. Abra a página de novo em alguns minutos.</p>
      )}
      {check.fix && <p className="text-sm text-foreground">{check.fix}</p>}
      {check.found.length > 0 && check.status !== "ok" && (
        <div className="text-sm">
          <p className="text-xs font-medium text-muted-foreground">Publicado hoje</p>
          <ul className="mt-1 grid gap-0.5">
            {check.found.map((value, index) => (
              <li key={index} className="font-mono text-[13px] break-all text-muted-foreground">
                {value}
              </li>
            ))}
          </ul>
        </div>
      )}
      {check.record && (
        <div className="divide-y rounded-lg border bg-field/60 px-3">
          <RecordLine label="Tipo" value={check.record.type} />
          <RecordLine label="Nome" value={check.record.name} copy />
          <RecordLine label="Valor" value={check.record.value} copy />
        </div>
      )}
    </li>
  );
}

export function DnsHealth({ domain, checks }: { domain: string; checks: DnsCheck[] }) {
  return (
    <section aria-label={`Saúde do DNS de ${domain}`} className="reveal-fade overflow-hidden rounded-xl border bg-card shadow-card [--i:1]">
      <ul className="divide-y">
        {checks.map((check) => (
          <Check key={check.key} check={check} />
        ))}
      </ul>
    </section>
  );
}
