"use client";
import { useId, useState } from "react";
import { MailPlusIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { ConfirmAction, FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { currency } from "@/lib/format";
import { addMailDomain, contractMail, recheckMailDns, removeMailDomainClaim, verifyMailDomain } from "@/lib/mail/mail-setup-actions";
import { Dot, choice } from "./mail-pieces";

export type MailOffer = { id: string; name: string; description: string | null; amountCents: number | null; interval: "monthly" | "yearly" | null };

const priceLabel = (offer: MailOffer) =>
  offer.amountCents ? `${currency(offer.amountCents)} ${offer.interval === "yearly" ? "por ano" : "por mês"}` : "Valor combinado com a equipe";

/**
 * "Contratar e-mail" in Produtos, for a company's Administrador: the plan
 * from the catalog and, managing more than one company, which one. The
 * product starts at once; the team sends the bill afterwards.
 */
export function ContractMailButton({ companies, offers }: { companies: { id: string; name: string }[]; offers: MailOffer[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!companies.length || !offers.length) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-assistant-action="">
        <MailPlusIcon />
        Contratar e-mail
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        size="md"
        title="Contratar e-mail"
        description="Caixas de e-mail com o domínio da empresa, no servidor da Anuntech."
        action={contractMail}
        formKey={open ? "open" : "closed"}
        submitLabel="Contratar"
        pendingLabel="Contratando…"
      >
        {companies.length > 1 ? (
          <FormField label="Empresa" htmlFor={`${id}-company`}>
            <NativeSelect id={`${id}-company`} name="companyId" defaultValue={companies[0].id}>
              {companies.map((company) => (
                <NativeSelectOption key={company.id} value={company.id}>
                  {company.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
        ) : (
          <input type="hidden" name="companyId" value={companies[0].id} />
        )}
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium text-foreground">Plano</legend>
          {offers.map((offer, index) => (
            <label key={offer.id} className={choice}>
              <input type="radio" name="catalogItemId" value={offer.id} defaultChecked={index === 0} className="sr-only" />
              <Dot />
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{offer.name}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">{priceLabel(offer)}</span>
                {offer.description && <span className="mt-1 block text-xs text-muted-foreground">{offer.description}</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="grid gap-1.5 rounded-lg border bg-field/60 px-3 py-2.5 text-sm text-muted-foreground">
          <p>O e-mail começa agora. A equipe da Anuntech manda a cobrança pelo Financeiro, como nos outros produtos.</p>
          <p>Depois de contratar, você adiciona o domínio da empresa e publica os registros que o Console mostrar no painel de DNS do domínio.</p>
        </div>
      </FormSheet>
    </>
  );
}

/** "Adicionar domínio": the domain waits for the proof before anything goes to the server. */
export function AddDomainButton({ companyId, primary = false }: { companyId: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <Button variant={primary ? "default" : "outline"} onClick={() => setOpen(true)} data-assistant-action="">
        <PlusIcon />
        Adicionar domínio
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        size="md"
        title="Adicionar domínio"
        description="O domínio que vem depois do @ nos endereços da empresa."
        action={addMailDomain}
        formKey={open ? "open" : "closed"}
        submitLabel="Adicionar"
        pendingLabel="Adicionando…"
      >
        <input type="hidden" name="companyId" value={companyId} />
        <FormField label="Domínio" htmlFor={`${id}-domain`} hint="Ex.: empresa.com.br, sem www e sem @.">
          <Input id={`${id}-domain`} name="domain" required maxLength={253} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="empresa.com.br" />
        </FormField>
        <p className="text-sm text-muted-foreground">
          No próximo passo, o Console mostra um registro para você criar no painel de DNS do domínio (Cloudflare, Registro.br, GoDaddy, Hostinger ou outro). Ele prova que o domínio é da empresa. Nada muda no e-mail de hoje.
        </p>
      </FormSheet>
    </>
  );
}

/** "Conferir agora" on a domain waiting for the proof. */
export function VerifyDomainForm({ id }: { id: string }) {
  return (
    <ServerForm action={verifyMailDomain} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <FormError />
      <div>
        <SubmitButton pendingLabel="Conferindo…">
          <RefreshCwIcon />
          Conferir agora
        </SubmitButton>
      </div>
    </ServerForm>
  );
}

/** Takes a domain out of the waiting list (nothing was on the server for it). */
export function RemoveClaimButton({ id, domain }: { id: string; domain: string }) {
  return (
    <ConfirmAction
      action={removeMailDomainClaim}
      fields={{ id }}
      title={`Remover ${domain}?`}
      description="O domínio sai da lista de espera. Nada foi criado no servidor de e-mail. Se quiser usar depois, adicione de novo."
      confirmLabel="Remover"
      destructive
    >
      <Button variant="ghost">
        <Trash2Icon />
        Remover
      </Button>
    </ConfirmAction>
  );
}

/** "Conferir de novo" on the DNS guide: asks the DNS now. */
export function RecheckDnsForm({ domain }: { domain: string }) {
  return (
    <ServerForm action={recheckMailDns}>
      <input type="hidden" name="domain" value={domain} />
      <SubmitButton variant="outline" pendingLabel="Conferindo…">
        <RefreshCwIcon />
        Conferir de novo
      </SubmitButton>
    </ServerForm>
  );
}
