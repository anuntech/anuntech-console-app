"use client";
import { useActionState, useId, useState } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
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
import { FormField } from "@/components/console/form-field";
import {
  FormAlert,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { CodeInput } from "@/components/auth/login-form";
import {
  confirmAccountDeletion,
  requestAccountDeletion,
  type AccountDeletionState,
} from "@/lib/account/account-actions";

const WORD = "EXCLUIR";

/**
 * Deleting the account: a fresh code on a verified contact, then the typed
 * word. The person leaves signed out, on the sign-in page.
 */
export function AccountDeletion({
  owner,
  hasWhatsapp,
}: {
  owner: boolean;
  hasWhatsapp: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">
        {owner
          ? "A conta do proprietário do Console não pode ser excluída. Transfira a administração antes."
          : "Seus dados pessoais são apagados e você perde o acesso a todas as empresas. Não dá para desfazer."}
      </p>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        disabled={owner}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon />
        Excluir minha conta
      </Button>
      {open && (
        <DeletionDialog
          hasWhatsapp={hasWhatsapp}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function DeletionDialog({
  hasWhatsapp,
  onClose,
}: {
  hasWhatsapp: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const [state, request, requesting] = useActionState<
    AccountDeletionState,
    FormData
  >(requestAccountDeletion, {});
  const [code, setCode] = useState("");
  const [word, setWord] = useState("");
  const challenge = state.challengeId ? state : null;
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        {!challenge ? (
          <form action={request} className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>Excluir sua conta?</DialogTitle>
              <DialogDescription>
                Para confirmar que é você, enviamos um código novo.
              </DialogDescription>
            </DialogHeader>
            {state.error && <FormAlert>{state.error}</FormAlert>}
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
              <li>
                <strong className="font-semibold">Apagamos</strong> seu nome,
                e-mails, telefone, foto, sessões, conversas com o assistente e
                as pastas de bookmarks que só você via.
              </li>
              <li>
                <strong className="font-semibold">Ficam com a empresa</strong>,
                com o autor &quot;Conta excluída&quot;: chamados e mensagens,
                assinaturas de contrato, horas e faturas.
              </li>
              <li>
                Você perde o acesso a todas as empresas. Para voltar, alguém
                precisa convidar você de novo.
              </li>
            </ul>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              {hasWhatsapp && (
                <Button
                  type="submit"
                  name="channel"
                  value="whatsapp"
                  variant="outline"
                  disabled={requesting}
                >
                  Código no WhatsApp
                </Button>
              )}
              <Button
                type="submit"
                name="channel"
                value="email"
                disabled={requesting}
              >
                {requesting && <Loader2Icon className="animate-spin" />}
                {requesting ? "Enviando…" : "Código no e-mail"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <ServerForm
            action={confirmAccountDeletion}
            className="flex flex-col gap-5"
            data-assistant-ignore=""
            onSuccess={(result) => {
              // A full load: the session cookies were just cleared.
              if (result.href) window.location.assign(result.href);
            }}
          >
            <input type="hidden" name="challengeId" value={challenge.challengeId} />
            <input type="hidden" name="code" value={code} />
            <DialogHeader>
              <DialogTitle>Confirme a exclusão</DialogTitle>
              <DialogDescription>
                O código vale por 5 minutos e aceita 3 tentativas.
              </DialogDescription>
            </DialogHeader>
            <FormError />
            <div>
              <Label className="mb-2">
                Código enviado para {challenge.destination}
              </Label>
              <CodeInput value={code} onChange={setCode} autoFocus />
            </div>
            <FormField label={`Digite ${WORD} para confirmar`} htmlFor={`${id}-word`}>
              <Input
                id={`${id}-word`}
                name="confirmation"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={40}
                value={word}
                onChange={(event) => setWord(event.target.value)}
              />
            </FormField>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <SubmitButton
                variant="destructive"
                pendingLabel="Excluindo…"
                disabled={
                  code.length !== 6 || word.trim().toUpperCase() !== WORD
                }
              >
                Excluir conta
              </SubmitButton>
            </DialogFooter>
          </ServerForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
