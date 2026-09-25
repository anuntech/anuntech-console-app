"use client";
import { useActionState, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormField } from "@/components/console/form-field";
import {
  FormAlert,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { CodeInput } from "@/components/auth/login-form";
import { normalizePhone, useCooldown } from "@/components/auth/otp";
import { toast } from "@/components/notifications";
import { authClient } from "@/lib/auth-client";
import {
  confirmAccountEmail,
  requestAccountEmail,
  updateAccountName,
  type AccountEmailState,
} from "@/lib/account-actions";
import { formatPhone } from "@/lib/company-input";

export function NameForm({ name }: { name: string }) {
  const [value, setValue] = useState(name);
  return (
    <ServerForm action={updateAccountName} className="flex flex-col gap-5">
      <FormError />
      <FormField label="Nome" htmlFor="account-name">
        <Input
          id="account-name"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </FormField>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Salvando…" disabled={value.trim() === name.trim()}>
          Salvar
        </SubmitButton>
      </div>
    </ServerForm>
  );
}

/** One contact per row: what it is, its value, and what can be done with it. */
export function ContactRow({
  icon,
  label,
  value,
  hint,
  actions,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  /** Dialogs that belong to the row. */
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-4 px-6 py-4">
      {children}
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1 basis-48">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block truncate text-sm text-foreground">{value}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      {actions && <span className="flex shrink-0 items-center gap-1">{actions}</span>}
    </li>
  );
}

/** Changing the sign-in e-mail: a code on the current address, one on the new. */
export function EmailRow({ email, locked }: { email: string; locked: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <ContactRow
      icon={<MailIcon />}
      label="E-mail de acesso"
      value={email}
      actions={
        <Button
          variant="ghost"
          size="sm"
          disabled={locked}
          onClick={() => setOpen(true)}
        >
          <PencilIcon />
          Alterar
        </Button>
      }
    >
      {open && <EmailChangeDialog email={email} onClose={() => setOpen(false)} />}
    </ContactRow>
  );
}

function EmailChangeDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const id = useId();
  const [state, request, requesting] = useActionState<AccountEmailState, FormData>(
    requestAccountEmail,
    {},
  );
  const [sourceCode, setSourceCode] = useState("");
  const [targetCode, setTargetCode] = useState("");
  const challenge = state.challengeId ? state : null;
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        {!challenge ? (
          <form action={request} className="flex flex-col gap-5">
            <input type="hidden" name="primary" value="true" />
            <DialogHeader>
              <DialogTitle>Alterar e-mail de acesso</DialogTitle>
              <DialogDescription>
                Você recebe um código no e-mail atual e outro no novo. Depois de
                confirmar, entra novamente com o novo endereço.
              </DialogDescription>
            </DialogHeader>
            {/* The id wraps the alert so the field can point at it. */}
            {state.error && (
              <div id={`${id}-error`}>
                <FormAlert>{state.error}</FormAlert>
              </div>
            )}
            <FormField label="Novo e-mail" htmlFor={`${id}-email`}>
              <Input
                id={`${id}-email`}
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                autoFocus
                placeholder="voce@empresa.com.br"
                aria-describedby={state.error ? `${id}-error` : undefined}
              />
            </FormField>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={requesting}>
                {requesting && <Loader2Icon className="animate-spin" />}
                {requesting ? "Enviando códigos…" : "Enviar códigos"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <ServerForm action={confirmAccountEmail} className="flex flex-col gap-5">
            <input type="hidden" name="challengeId" value={challenge.challengeId} />
            <input type="hidden" name="sourceCode" value={sourceCode} />
            <input type="hidden" name="targetCode" value={targetCode} />
            <DialogHeader>
              <DialogTitle>Confirme os dois códigos</DialogTitle>
              <DialogDescription>
                Cada endereço recebeu um código de 6 números. Eles valem por 5
                minutos.
              </DialogDescription>
            </DialogHeader>
            <FormError />
            <div>
              <Label className="mb-2">Código enviado para {email}</Label>
              <CodeInput value={sourceCode} onChange={setSourceCode} autoFocus />
            </div>
            <div>
              <Label className="mb-2">Código enviado para {challenge.email}</Label>
              <CodeInput value={targetCode} onChange={setTargetCode} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <SubmitButton
                pendingLabel="Confirmando…"
                disabled={sourceCode.length !== 6 || targetCode.length !== 6}
              >
                Confirmar e-mail
              </SubmitButton>
            </DialogFooter>
          </ServerForm>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Brazilian numbers get the local mask; another DDI stays exactly as typed. */
function maskPhone(value: string) {
  const trimmed = value.trimStart();
  return /^\+(?!55)/.test(trimmed) ? trimmed.slice(0, 25) : formatPhone(trimmed);
}

/** The WhatsApp number that can sign in: link, replace or remove it. */
export function WhatsappRow({ phone, locked }: { phone: string | null; locked: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await authClient.updateUser({ phoneNumber: null });
      if (result.error) throw new Error();
      toast.success("Telefone removido.");
      setRemoving(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível remover o telefone. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ContactRow
      icon={<MessageCircleIcon />}
      label="WhatsApp"
      value={
        phone ? (
          formatPhone(phone.replace(/^\+55/, ""))
        ) : (
          <span className="text-muted-foreground">Não vinculado</span>
        )
      }
      hint={!phone && !locked ? "Vincule para entrar por código no WhatsApp." : undefined}
      actions={
        <>
          <Button variant="ghost" size="sm" disabled={locked} onClick={() => setEditing(true)}>
            <PencilIcon />
            {phone ? "Alterar" : "Vincular"}
          </Button>
          {phone && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={locked}
              onClick={() => setRemoving(true)}
            >
              <Trash2Icon />
              Remover
            </Button>
          )}
        </>
      }
    >
      {editing && <WhatsappDialog current={phone} onClose={() => setEditing(false)} />}
      <AlertDialog open={removing} onOpenChange={(open) => !busy && setRemoving(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              O número deixa de servir para entrar. Você continua acessando por
              e-mail ou Google.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {busy ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContactRow>
  );
}

function WhatsappDialog({ current, onClose }: { current: string | null; onClose: () => void }) {
  const router = useRouter();
  const id = useId();
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seconds, startCooldown] = useCooldown();
  const normalized = number.trim() ? normalizePhone(number) : "";
  const valid = /^\+[1-9]\d{9,14}$/.test(normalized);

  async function act(action: "send" | "verify", candidate = code) {
    if (busy) return;
    if (action === "send" && seconds > 0) return;
    if (action === "verify" && candidate.length !== 6) return;
    if (!valid) {
      setError("Informe um telefone válido com DDD. Para outro país, use + e o DDI.");
      return;
    }
    if (normalized === current) {
      setError("Este já é o seu WhatsApp.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result =
        action === "send"
          ? await authClient.phoneNumber.sendOtp(
              { phoneNumber: normalized },
              { headers: { "x-console-purpose": "bind" } },
            )
          : await authClient.phoneNumber.verify({
              phoneNumber: normalized,
              code: candidate,
              updatePhoneNumber: true,
              disableSession: true,
            });
      if (result.error) {
        if (result.error.status === 401)
          setError("Não foi possível validar sua sessão. Entre novamente e refaça a alteração.");
        else if (result.error.status === 429) setError("Aguarde antes de pedir outro código.");
        else if (result.error.code === "PHONE_NUMBER_EXIST") {
          setSent(false);
          setCode("");
          setError("Este telefone já está vinculado a outra conta. Informe outro número.");
        } else if (result.error.status >= 500)
          setError("O envio ou a confirmação está indisponível. Aguarde e tente novamente.");
        else if (action === "verify") {
          setCode("");
          setError("Código inválido ou expirado. Confira o código ou peça outro.");
        } else setError("Não foi possível enviar o código. Confira o número.");
        return;
      }
      if (action === "send") {
        setSent(true);
        setCode("");
        startCooldown();
      } else {
        toast.success("WhatsApp confirmado e atualizado.");
        onClose();
        router.refresh();
      }
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void act(sent ? "verify" : "send");
          }}
        >
          <DialogHeader>
            <DialogTitle>{current ? "Alterar WhatsApp" : "Vincular WhatsApp"}</DialogTitle>
            <DialogDescription>
              Um código de 6 números confirma que o número é seu. Ele vale por 5
              minutos.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div id={`${id}-error`}>
              <FormAlert>{error}</FormAlert>
            </div>
          )}
          {sent ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/50 py-2 pr-1.5 pl-3 text-sm">
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Código enviado para</span>
                  <span className="block truncate font-medium text-foreground">{number}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy}
                  onClick={() => {
                    setSent(false);
                    setCode("");
                    setError("");
                  }}
                >
                  Alterar
                </Button>
              </div>
              <div>
                <Label className="mb-2">Código de confirmação</Label>
                <CodeInput
                  value={code}
                  onChange={setCode}
                  onComplete={() => void act("verify")}
                  disabled={busy}
                  invalid={!!error}
                  describedBy={error ? `${id}-error` : undefined}
                  autoFocus
                />
              </div>
            </>
          ) : (
            <FormField
              label="Número com DDD"
              htmlFor={`${id}-phone`}
              hint="Para outro país, comece com + e o DDI."
            >
              <Input
                id={`${id}-phone`}
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={25}
                required
                autoFocus
                value={number}
                placeholder="(11) 99999-9999"
                onChange={(event) => {
                  setNumber(maskPhone(event.target.value));
                  setError("");
                }}
              />
            </FormField>
          )}
          <DialogFooter className="sm:justify-between">
            {sent ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={busy || seconds > 0}
                onClick={() => void act("send")}
              >
                {seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
              </Button>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={busy || (sent ? code.length !== 6 : !valid || seconds > 0)}>
                {busy && <Loader2Icon className="animate-spin" />}
                {busy ? "Aguarde…" : sent ? "Confirmar" : "Receber código"}
              </Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

