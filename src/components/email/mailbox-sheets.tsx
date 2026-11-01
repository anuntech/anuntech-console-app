"use client";
import { useId, useState } from "react";
import { DownloadIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CopyButton } from "@/components/console/copy-button";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { HelpLink } from "@/components/console/help-link";
import { TokenChip } from "@/components/console/token-chip";
import {
  createMailbox,
  deleteMailbox,
  resetMailboxPassword,
  updateMailbox,
  type MailActionState,
} from "@/lib/mail/mail-actions";
import {
  DEFAULT_QUOTA_GB,
  MAIL_CLIENT_HOST,
  MAIL_PORTS,
  MAILBOX_ALIASES_MAX,
  QUOTA_OPTIONS_GB,
  localPartProblem,
  normalizeLocalPart,
  quotaChoice,
  storageLabel,
} from "@/lib/mail/mail-rules";
import type { MailboxRow } from "@/lib/mail/mail-types";
import type { ActionState } from "@/lib/action-state";
import { PasswordChoice, SecretSheet, type Secret } from "./mail-pieces";

/** The help article with the step by step for each app. */
export const DEVICES_HELP = "configurar-email-nos-aparelhos";

/** A plain input inside a framed group: the legacy layer's own input look is undone here. */
const bareInput =
  "h-9 min-h-0 w-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 py-0 text-sm shadow-none outline-none hover:border-0 focus:shadow-none focus-visible:outline-none";

/** The address field: the local part, with the domain fixed beside it. */
export function AddressInput({ id, domain, name = "local", defaultValue }: { id: string; domain: string; name?: string; defaultValue?: string }) {
  return (
    <div className="flex min-w-0 items-center rounded-lg border border-input bg-field focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <input
        id={id}
        name={name}
        required
        maxLength={64}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={defaultValue}
        className={bareInput}
      />
      <span className="shrink-0 pr-3 text-sm text-muted-foreground">@{domain}</span>
    </div>
  );
}

function QuotaSelect({ id, current }: { id: string; current?: number | null }) {
  const choice = current === undefined ? DEFAULT_QUOTA_GB : quotaChoice(current);
  return (
    <NativeSelect id={id} name="quota" defaultValue={choice === null ? "keep" : String(choice)}>
      {choice === null && current !== undefined && (
        <NativeSelectOption value="keep">{current ? `Manter ${storageLabel(current)}` : "Manter sem limite"}</NativeSelectOption>
      )}
      {QUOTA_OPTIONS_GB.map((gb) => (
        <NativeSelectOption key={gb} value={String(gb)}>
          {gb} GB
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** "Nova caixa": the sheet, then the generated password once. */
export function NewMailboxButton({ domain }: { domain: string }) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const id = useId();
  return (
    <>
      <Button onClick={() => setOpen(true)} data-assistant-action="">
        <PlusIcon />
        Nova caixa
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        size="md"
        title="Nova caixa"
        description="A caixa nasce vazia, pronta para entrar pelos aplicativos de e-mail."
        action={createMailbox}
        formKey={open ? "open" : "closed"}
        submitLabel="Criar caixa"
        pendingLabel="Criando…"
        onSuccess={(state) => {
          const answer = state as MailActionState;
          setOpen(false);
          if (answer.password && answer.address) setSecret({ address: answer.address, password: answer.password, title: `Caixa ${answer.address} criada` });
        }}
      >
        <input type="hidden" name="domain" value={domain} />
        <FormField label="Endereço" htmlFor={`${id}-local`} hint="Letras sem acento, números, ponto ou hífen.">
          <AddressInput id={`${id}-local`} domain={domain} />
        </FormField>
        <FormField label="Nome" htmlFor={`${id}-name`} hint="Da pessoa ou da equipe que usa a caixa.">
          <Input id={`${id}-name`} name="name" maxLength={120} placeholder="Ex.: Financeiro" />
        </FormField>
        <FormField label="Espaço" htmlFor={`${id}-quota`}>
          <QuotaSelect id={`${id}-quota`} />
        </FormField>
        {/* The assistant never reads or fills a password. */}
        <div data-assistant-ignore="" className="contents">
          <PasswordChoice />
        </div>
      </FormSheet>
      <SecretSheet secret={secret} onClose={() => setSecret(null)} />
    </>
  );
}

/** Aliases as chips; each one goes to the action as an `alias` field. */
function AliasesField({ id, domain, own, initial }: { id: string; domain: string; own: string; initial: string[] }) {
  const [aliases, setAliases] = useState(initial);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const add = () => {
    const local = normalizeLocalPart(draft, domain);
    if (!local) return;
    const issue =
      localPartProblem(local) ??
      (local === own ? "Esse já é o endereço da caixa." : aliases.includes(local) ? "Esse apelido já está na lista." : null) ??
      (aliases.length >= MAILBOX_ALIASES_MAX ? `Até ${MAILBOX_ALIASES_MAX} apelidos por caixa.` : null);
    setProblem(issue);
    if (issue) return;
    setAliases((list) => [...list, local]);
    setDraft("");
  };
  return (
    <div className="grid gap-2">
      {aliases.map((alias) => (
        <input key={alias} type="hidden" name="alias" value={alias} />
      ))}
      {aliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aliases.map((alias) => (
            <TokenChip key={alias} onRemove={() => setAliases((list) => list.filter((a) => a !== alias))} removeLabel={`Remover ${alias}@${domain}`}>
              <span className="truncate">
                {alias}@{domain}
              </span>
            </TokenChip>
          ))}
        </div>
      )}
      <div className="flex min-w-0 gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-lg border border-input bg-field focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <input
            id={id}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
            maxLength={64}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby={problem ? `${id}-problem` : undefined}
            aria-invalid={problem ? true : undefined}
            className={bareInput}
          />
          <span className="shrink-0 pr-3 text-sm text-muted-foreground max-[360px]:hidden">@{domain}</span>
        </div>
        <Button type="button" variant="outline" onClick={add}>
          Adicionar
        </Button>
      </div>
      {problem && (
        <p id={`${id}-problem`} className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

export function EditMailboxSheet({ open, onOpenChange, mailbox }: { open: boolean; onOpenChange: (open: boolean) => void; mailbox: MailboxRow | null }) {
  const id = useId();
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={mailbox ? `Editar ${mailbox.address}` : "Editar caixa"}
      description="O endereço não muda. Para outro endereço, use um apelido."
      action={updateMailbox}
      formKey={mailbox?.id ?? "none"}
      submitLabel="Salvar"
    >
      {mailbox && (
        <>
          <input type="hidden" name="id" value={mailbox.id} />
          <FormField label="Nome" htmlFor={`${id}-name`} hint="Da pessoa ou da equipe que usa a caixa.">
            <Input id={`${id}-name`} name="name" maxLength={120} defaultValue={mailbox.name ?? ""} />
          </FormField>
          <FormField label="Espaço" htmlFor={`${id}-quota`} hint={`Usados agora: ${storageLabel(mailbox.usedBytes)}.`}>
            <QuotaSelect id={`${id}-quota`} current={mailbox.quotaBytes} />
          </FormField>
          <FormField label="Apelidos" htmlFor={`${id}-alias`} hint="Outros endereços do mesmo domínio que chegam nesta caixa.">
            <AliasesField id={`${id}-alias`} domain={mailbox.domain} own={mailbox.local} initial={mailbox.aliases} />
          </FormField>
        </>
      )}
    </FormSheet>
  );
}

export function PasswordSheet({ open, onOpenChange, mailbox }: { open: boolean; onOpenChange: (open: boolean) => void; mailbox: MailboxRow | null }) {
  const [secret, setSecret] = useState<Secret | null>(null);
  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        title="Trocar senha"
        description={mailbox ? `${mailbox.address}. Os aplicativos conectados com a senha antiga vão pedir a nova.` : undefined}
        action={resetMailboxPassword}
        formKey={mailbox?.id ?? "none"}
        submitLabel="Trocar senha"
        pendingLabel="Trocando…"
        onSuccess={(state: ActionState) => {
          const answer = state as MailActionState;
          onOpenChange(false);
          if (answer.password && answer.address) setSecret({ address: answer.address, password: answer.password, title: "Senha nova" });
        }}
      >
        {mailbox && (
          <div data-assistant-ignore="" className="contents">
            <input type="hidden" name="id" value={mailbox.id} />
            <PasswordChoice />
          </div>
        )}
      </FormSheet>
      <SecretSheet secret={secret} onClose={() => setSecret(null)} />
    </>
  );
}

function CopyRow({ label, value, copied }: { label: string; value: string; copied?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-mono text-sm break-all text-foreground">{value}</p>
      </div>
      <CopyButton value={value} label={label} copiedText={copied} />
    </div>
  );
}

/** What any mail app needs, to copy, and the Apple profile without the password. */
export function DevicesSheet({ open, onOpenChange, mailbox }: { open: boolean; onOpenChange: (open: boolean) => void; mailbox: MailboxRow | null }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Configurar aparelhos</SheetTitle>
          <SheetDescription>{mailbox?.address ?? "Caixa"}</SheetDescription>
        </SheetHeader>
        {mailbox && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="grid gap-6">
              <section className="grid gap-3">
                <h3 className="text-sm font-medium text-foreground">iPhone, iPad e Mac</h3>
                <p className="text-sm text-muted-foreground">
                  Abra o perfil no próprio aparelho e instale em Ajustes. A senha é pedida na instalação: o arquivo não leva a senha.
                </p>
                <Button asChild variant="outline" className="justify-self-start">
                  <a href={`/api/email/perfil/${encodeURIComponent(mailbox.id)}`} download>
                    <DownloadIcon />
                    Baixar perfil para iPhone/Mac
                  </a>
                </Button>
              </section>
              <section className="grid gap-1">
                <h3 className="text-sm font-medium text-foreground">Outros aplicativos</h3>
                <p className="text-sm text-muted-foreground">Outlook, Gmail, Thunderbird, Mailbird: escolha IMAP e use estes dados.</p>
                <div className="mt-2 divide-y rounded-lg border px-3">
                  <CopyRow label="Usuário" value={mailbox.address} />
                  <CopyRow label="Servidor de entrada (IMAP)" value={MAIL_CLIENT_HOST} />
                  <div className="py-2 text-sm text-foreground">
                    Porta {MAIL_PORTS.imap.port}, segurança {MAIL_PORTS.imap.security}
                  </div>
                  <CopyRow label="Servidor de saída (SMTP)" value={MAIL_CLIENT_HOST} />
                  <div className="py-2 text-sm text-foreground">
                    Porta {MAIL_PORTS.smtp.port}, segurança {MAIL_PORTS.smtp.security} (ou {MAIL_PORTS.smtpStarttls.port}, {MAIL_PORTS.smtpStarttls.security})
                  </div>
                  <div className="py-2 text-sm text-foreground">Entrada e saída com o mesmo usuário e a senha da caixa.</div>
                </div>
              </section>
              <HelpLink slug={DEVICES_HELP} newTab>
                Passo a passo no Outlook, no Gmail e no Mailbird
              </HelpLink>
            </div>
          </div>
        )}
        <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Deleting a mailbox deletes all of its mail on the server: the person types
 * the full address, and their own mailbox asks for one more confirmation.
 */
export function DeleteMailboxDialog({ open, onOpenChange, mailbox }: { open: boolean; onOpenChange: (open: boolean) => void; mailbox: MailboxRow | null }) {
  const [typed, setTyped] = useState("");
  const [own, setOwn] = useState(false);
  const id = useId();
  const matches = !!mailbox && typed.trim().toLowerCase() === mailbox.address;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setTyped("");
          setOwn(false);
        }
      }}
    >
      <AlertDialogContent>
        {/* Deleting is the person's call: the assistant never reads or sends this form. */}
        <ServerForm action={deleteMailbox} data-assistant-ignore="" onSuccess={() => onOpenChange(false)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {mailbox?.address}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os e-mails da caixa são apagados no servidor e não voltam. Os aplicativos conectados param de receber e enviar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4 grid gap-4">
            <FormError />
            {mailbox && <input type="hidden" name="id" value={mailbox.id} />}
            {mailbox?.own && (
              <div className="grid gap-3 rounded-lg border border-destructive-edge bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
                <p className="flex items-start gap-2">
                  <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  Esta é a sua própria caixa. Você perde os e-mails e o acesso a ela agora.
                </p>
                <label className="checkbox-field text-foreground">
                  <input type="checkbox" name="own" checked={own} onChange={(event) => setOwn(event.target.checked)} />
                  Entendo e quero excluir a minha caixa.
                </label>
              </div>
            )}
            <FormField label={`Para confirmar, digite ${mailbox?.address ?? "o endereço"}`} htmlFor={`${id}-confirm`}>
              <Input
                id={`${id}-confirm`}
                name="confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </FormField>
          </div>
          <AlertDialogFooter className="mt-5">
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <SubmitButton variant="destructive" pendingLabel="Excluindo…" disabled={!matches || (!!mailbox?.own && !own)}>
              Excluir caixa
            </SubmitButton>
          </AlertDialogFooter>
        </ServerForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
