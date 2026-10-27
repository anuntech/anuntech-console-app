"use client";
import { LockKeyholeIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/console/form-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { unlockShareLink } from "@/lib/drive/drive-actions";

/** A password-protected link: the visitor types it once, and the page opens in that browser. */
export function ShareUnlock({ token }: { token: string }) {
  return (
    <ServerForm action={unlockShareLink} quiet className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LockKeyholeIcon className="size-4" aria-hidden="true" />
        Este link tem senha. Peça a senha a quem enviou.
      </div>
      <FormError />
      <FormField label="Senha" htmlFor="share-password">
        <Input id="share-password" name="password" type="password" required autoFocus autoComplete="off" maxLength={200} />
      </FormField>
      <SubmitButton pendingLabel="Abrindo…">Abrir</SubmitButton>
    </ServerForm>
  );
}
