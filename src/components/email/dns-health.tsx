import type { CSSProperties } from "react";
import { CircleCheckIcon, CircleHelpIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { CopyButton } from "@/components/console/copy-button";
import { dnsPanelName, type DnsCheck, type DnsStage, type mailArrival } from "@/lib/mail/mail-rules";

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
function Check({ check, domain }: { check: DnsCheck; domain: string }) {
  const status = STATUS[check.status];
  const Icon = status.icon;
  return (
    <li className="grid gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-body-sm font-medium text-foreground">{check.title}</h3>
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
          {dnsPanelName(check.record.name, domain) !== check.record.name && <RecordLine label="Nome no painel" value={dnsPanelName(check.record.name, domain)} copy />}
          <RecordLine label="Valor" value={check.record.value} copy />
        </div>
      )}
    </li>
  );
}

type Arrival = ReturnType<typeof mailArrival>;

/** What each group of the guide is for; the switch's text says where the mail lands today. */
function stageText(stage: DnsStage, arrival: Arrival | undefined) {
  if (stage === "proof") return { title: "Prova de posse", text: "Crie este registro no painel de DNS do domínio e clique em Conferir agora." };
  if (stage === "now") return { title: "Pode publicar agora", text: "Estes registros não mudam nada no e-mail de hoje." };
  const text =
    arrival === "elsewhere"
      ? "Hoje os e-mails do domínio chegam em outro provedor. Crie as caixas aqui e copie os e-mails antigos antes de trocar estes registros: a partir da troca, tudo chega no servidor da Anuntech."
      : arrival === "none"
        ? "O domínio ainda não recebe e-mail. Pode publicar estes junto com os outros."
        : arrival === "here"
          ? "Os e-mails do domínio já chegam no servidor da Anuntech."
          : "Estes registros levam o e-mail do domínio para o servidor da Anuntech.";
  return { title: "Na hora da troca", text };
}

/**
 * The domain's records in the order a client publishes them: the proof
 * (while the domain waits for it), what can go up at once, and the switch
 * from the old provider. One list when everything is in one group.
 */
export function DnsHealth({ domain, checks, arrival }: { domain: string; checks: DnsCheck[]; arrival?: Arrival }) {
  const groups = (["proof", "now", "switch"] as const)
    .map((stage) => ({ stage, checks: checks.filter((check) => check.stage === stage) }))
    .filter((group) => group.checks.length);
  return (
    <div aria-label={`Saúde do DNS de ${domain}`} className="grid gap-6">
      {groups.map((group, index) => {
        const { title, text } = stageText(group.stage, arrival);
        return (
          <section key={group.stage} aria-labelledby={`dns-${group.stage}`} className="reveal-fade grid gap-2" style={{ "--i": index + 1 } as CSSProperties}>
            <div className="px-1">
              <h2 id={`dns-${group.stage}`} className="text-body font-medium text-foreground">
                {title}
              </h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
              {group.checks.map((check) => (
                <Check key={check.key} check={check} domain={domain} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
