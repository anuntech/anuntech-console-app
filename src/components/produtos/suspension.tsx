"use client";
import Link from "next/link";
import { useState } from "react";
import { BanIcon, CheckIcon, HeadsetIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DateField } from "@/components/console/date-field";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import {
  cancelSuspension,
  confirmSuspension,
  liftSuspension,
  prepareSuspension,
  recordSuspensionNotice,
  setSuspensionStep,
} from "@/lib/suspensions/suspension-actions";
import {
  SUSPENSION_REASONS,
  liftSteps,
  suspendSteps,
  suspensionKindHints,
  suspensionKindLabels,
  suspensionReasonLabels,
  suspensionStageLabels,
  type SuspensionReason,
} from "@/lib/suspensions/suspension-rules";
import type { SuspensionView } from "@/lib/suspensions/suspension-view";
import { suspensionNotice, type SuspendedProduct } from "@/lib/suspensions/suspension-notice";
import { addDays } from "@/lib/billing/recurrence";
import { saoPauloDate } from "@/lib/dates";
import { dateLabel, dateTimeLabel } from "@/lib/format";

/** `appPage` set: the product only opens inside the Console, which already refuses it while suspended. */
type Target = { id: string; name: string; appPage?: string | null; suspension?: SuspensionView };

const check = "mt-0.5 size-4 min-h-0 shrink-0 accent-primary";

/** What the client reads on Produtos while something is suspended: why, and the two ways out. */
export function SuspendedNotice({ products }: { products: SuspendedProduct[] }) {
  const notice = suspensionNotice(products);
  if (!notice) return null;
  const { canPay } = notice;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-start gap-3 rounded-lg border border-destructive-edge bg-destructive-soft px-4 py-3 text-sm">
      <BanIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="m-0 font-medium text-destructive">{notice.title}</p>
        <p className="m-0 mt-0.5 text-foreground">{notice.text}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canPay && (
          <Button size="sm" asChild>
            <Link href="/financeiro?status=overdue">
              <WalletIcon />
              Pagar agora
            </Link>
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link href="/chamados/novo">
            <HeadsetIcon />
            Falar com a equipe
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * The team's suspension flow from a product menu: "Suspender…" opens the
 * form; an open suspension opens its sheet (the notice, confirming on the
 * day, the blocking steps, reactivating). Rendered once per list.
 */
export function useSuspension(rows: Target[]) {
  const [preparing, setPreparing] = useState<Target | null>(null);
  // By id, so a ticked step shows as soon as the list refreshes.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewing = rows.find((row) => row.id === viewingId && row.suspension) ?? null;
  // Let the menu close before a sheet takes focus.
  const open = (target: Target) => setTimeout(() => (target.suspension ? setViewingId(target.id) : setPreparing(target)), 0);
  const element = (
    <>
      <PrepareSheet target={preparing} onOpenChange={(value) => !value && setPreparing(null)} />
      <SuspensionSheet target={viewing} onOpenChange={(value) => !value && setViewingId(null)} />
    </>
  );
  return { open, element };
}

function PrepareSheet({ target, onOpenChange }: { target: Target | null; onOpenChange: (open: boolean) => void }) {
  const today = saoPauloDate();
  const [date, setDate] = useState(addDays(today, 5));
  const [reason, setReason] = useState<SuspensionReason>("overdue");
  const now = date === today;
  return (
    <FormSheet
      open={!!target}
      onOpenChange={onOpenChange}
      size="md"
      title={`Suspender ${target?.name ?? ""}`}
      description="Para atraso, o Console confere a fatura vencida e a cláusula das condições publicadas. Numa data futura, a suspensão fica agendada e a equipe confirma no dia."
      action={prepareSuspension}
      formKey={target?.id}
      submitLabel={now ? "Suspender agora" : "Agendar suspensão"}
      pendingLabel={now ? "Suspendendo…" : "Agendando…"}
    >
      <input type="hidden" name="engagementId" value={target?.id ?? ""} />
      <FormField label="Motivo" htmlFor="suspension-reason">
        <NativeSelect id="suspension-reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value as SuspensionReason)}>
          {SUSPENSION_REASONS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {suspensionReasonLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        label="Data da suspensão"
        htmlFor="suspension-date"
        hint={now ? "Hoje: o produto é suspenso ao salvar. Quando as condições pedem aviso, escolha uma data futura." : "O aviso vai hoje com esta data. No dia, a suspensão aparece no resumo para a equipe confirmar."}
      >
        <DateField id="suspension-date" name="date" value={date} onChange={setDate} min={today} required />
      </FormField>
      <FormField
        label="Justificativa (só a equipe vê)"
        htmlFor="suspension-note"
        hint={reason === "overdue" ? "Obrigatória quando o cliente não tem cláusula de suspensão publicada." : "Obrigatória: o que aconteceu e o que foi combinado."}
      >
        <Textarea id="suspension-note" name="note" maxLength={1000} rows={3} placeholder="Ex.: três boletos vencidos, sem resposta desde 02/10" />
      </FormField>
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" name="notify" value="yes" defaultChecked className={check} />
        <span>{now ? "Avisar o cliente por e-mail que o serviço foi suspenso." : "Mandar agora o aviso de suspensão por e-mail, com a data e o link de pagamento."}</span>
      </label>
    </FormSheet>
  );
}

function SuspensionSheet({ target, onOpenChange }: { target: Target | null; onOpenChange: (open: boolean) => void }) {
  const s = target?.suspension;
  return (
    <Sheet open={!!target} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{target?.name}</SheetTitle>
          <SheetDescription>{s ? `${suspensionStageLabels[s.stage]} · ${suspensionReasonLabels[s.reason]}` : ""}</SheetDescription>
        </SheetHeader>
        {s && <SuspensionBody key={`${s.id}-${s.stage}`} s={s} insideConsole={!!target?.appPage} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function SuspensionBody({ s, insideConsole, onDone }: { s: SuspensionView; insideConsole: boolean; onDone: () => void }) {
  const today = saoPauloDate();
  const early = !!s.scheduledFor && s.scheduledFor > today;
  return (
    <div className="flex flex-col gap-6 p-4 text-sm">
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
        {s.scheduledFor && (
          <>
            <dt className="text-muted-foreground">{s.suspendedAt ? "Agendada para" : "Suspender em"}</dt>
            <dd className="m-0 text-foreground">{dateLabel(s.scheduledFor)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Aviso</dt>
        <dd className="m-0 text-foreground">{s.noticeSentAt ? `Enviado em ${dateTimeLabel(s.noticeSentAt)}` : "Não enviado"}</dd>
        {s.suspendedAt && (
          <>
            <dt className="text-muted-foreground">Suspenso em</dt>
            <dd className="m-0 text-foreground">{dateTimeLabel(s.suspendedAt)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Bloqueio</dt>
        <dd className="m-0 text-foreground">{suspensionKindLabels[s.kind]}</dd>
        {s.note && (
          <>
            <dt className="text-muted-foreground">Justificativa</dt>
            <dd className="m-0 whitespace-pre-line text-foreground [overflow-wrap:anywhere]">{s.note}</dd>
          </>
        )}
      </dl>

      {s.stage === "scheduled" && (
        <>
          {!s.noticeSentAt && (
            <ServerForm action={recordSuspensionNotice} className="grid gap-3">
              <input type="hidden" name="id" value={s.id} />
              <FormError />
              <FormField label="Avisou por outro canal?" htmlFor={`notice-${s.id}`} hint="Registre por onde e quando, para poder confirmar a suspensão.">
                <Textarea id={`notice-${s.id}`} name="note" required maxLength={500} rows={2} placeholder="Ex.: WhatsApp do financeiro, 20/10" />
              </FormField>
              <SubmitButton variant="outline" size="sm" className="justify-self-start" pendingLabel="Registrando…">
                Registrar aviso
              </SubmitButton>
            </ServerForm>
          )}
          <ServerForm action={confirmSuspension} onSuccess={onDone} className="grid gap-3 rounded-lg border p-3">
            <input type="hidden" name="id" value={s.id} />
            <FormError />
            <p className="m-0 text-muted-foreground">
              {early ? `Dá para confirmar a partir de ${dateLabel(s.scheduledFor!)}. Se o cliente pagar antes, a suspensão é cancelada sozinha.` : "O Console confere de novo a fatura vencida e o aviso antes de suspender."}
            </p>
            <label className="flex items-start gap-2 text-foreground">
              <input type="checkbox" name="notify" value="yes" defaultChecked className={check} />
              <span>Avisar o cliente por e-mail que o serviço foi suspenso.</span>
            </label>
            <SubmitButton variant="destructive" className="justify-self-start" disabled={early} pendingLabel="Suspendendo…">
              <BanIcon />
              Suspender agora
            </SubmitButton>
          </ServerForm>
          <ServerForm action={cancelSuspension} onSuccess={onDone} className="grid gap-3">
            <input type="hidden" name="id" value={s.id} />
            <FormField label="Cancelar a suspensão" htmlFor={`cancel-${s.id}`} hint="Opcional: o que foi combinado.">
              <Textarea id={`cancel-${s.id}`} name="note" maxLength={1000} rows={2} />
            </FormField>
            <SubmitButton variant="outline" size="sm" className="justify-self-start" pendingLabel="Cancelando…">
              Cancelar suspensão
            </SubmitButton>
          </ServerForm>
        </>
      )}

      {s.stage !== "scheduled" && (
        <>
          {s.stage === "settled" && (
            <p className="m-0 rounded-lg border border-success-edge bg-success-soft px-3 py-2 text-success">
              O cliente pagou as faturas vencidas{s.settledAt ? ` (confirmado em ${dateTimeLabel(s.settledAt)})` : ""}. Reative e libere o acesso.
            </p>
          )}
          <section className="grid gap-2">
            <h3 className="m-0 text-sm font-semibold text-foreground">Passos para bloquear</h3>
            <p className="m-0 text-xs text-muted-foreground">
              {insideConsole
                ? "Este produto abre só pelo Console: enquanto estiver suspenso, ninguém da empresa (nem a equipe) entra nele, e o site público continua no ar. Uma sessão já aberta no app dura até expirar."
                : suspensionKindHints[s.kind]}
            </p>
            <ul className="m-0 grid list-none gap-1 p-0">
              {suspendSteps[s.kind].map((step) => {
                const done = s.steps[step.key];
                return (
                  <li key={step.key}>
                    <ServerForm action={setSuspensionStep} quiet>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="step" value={step.key} />
                      <input type="hidden" name="done" value={done ? "no" : "yes"} />
                      <button
                        type="submit"
                        aria-pressed={!!done}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                      >
                        <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border ${done ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
                          {done && <CheckIcon className="size-3" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-foreground">{step.label}</span>
                          {done && <span className="block text-xs text-muted-foreground">{`${done.by}, ${dateTimeLabel(done.at)}`}</span>}
                        </span>
                      </button>
                    </ServerForm>
                  </li>
                );
              })}
            </ul>
          </section>
          <ServerForm action={liftSuspension} onSuccess={onDone} className="grid gap-3 rounded-lg border p-3">
            <input type="hidden" name="id" value={s.id} />
            <FormError />
            <h3 className="m-0 text-sm font-semibold text-foreground">Reativar</h3>
            <fieldset className="m-0 grid gap-1.5 border-0 p-0">
              <legend className="mb-1 text-xs text-muted-foreground">Passos para liberar (marque o que já fez)</legend>
              {liftSteps[s.kind].map((step) => (
                <label key={step.key} className="flex items-start gap-2 text-foreground">
                  <input type="checkbox" name="liftStep" value={step.key} className={check} />
                  <span>{step.label}</span>
                </label>
              ))}
            </fieldset>
            <FormField
              label="O que foi resolvido"
              htmlFor={`lift-${s.id}`}
              hint={s.stage === "settled" ? "Opcional: o cliente já pagou." : "Obrigatório enquanto houver fatura vencida ou quando o motivo não é atraso."}
            >
              <Textarea id={`lift-${s.id}`} name="note" maxLength={1000} rows={2} />
            </FormField>
            <label className="flex items-start gap-2 text-foreground">
              <input type="checkbox" name="notify" value="yes" defaultChecked className={check} />
              <span>Avisar o cliente por e-mail que o serviço voltou.</span>
            </label>
            <SubmitButton className="justify-self-start" pendingLabel="Reativando…">
              Reativar
            </SubmitButton>
          </ServerForm>
        </>
      )}
    </div>
  );
}

/** Beside the status, for the team: a schedule not yet carried out, or a client who paid while suspended. */
export function SuspensionStageBadge({ suspension }: { suspension?: SuspensionView }) {
  if (!suspension || suspension.stage === "suspended" || suspension.stage === "lifted") return null;
  const tone = suspension.stage === "settled" ? "bg-success-soft text-success" : "bg-warning-soft text-warning";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}>
      {suspension.stage === "scheduled" && suspension.scheduledFor ? `Suspensão em ${dateLabel(suspension.scheduledFor)}` : suspensionStageLabels[suspension.stage]}
    </span>
  );
}
