"use client";
import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CopyButton } from "@/components/console/copy-button";
import { FormField } from "@/components/console/form-field";
import { PASSWORD_MIN, quotaUse, storageLabel } from "@/lib/mail/mail-rules";

/** Used space over the quota, as a thin bar; the text says it too, so colour is never the only sign. */
export function QuotaBar({ used, quota, className }: { used: number; quota: number | null; className?: string }) {
  const { percent, tone } = quotaUse(used, quota);
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-muted-foreground tabular-nums">
        {storageLabel(used)} {quota ? `de ${storageLabel(quota)}` : "usados, sem limite"}
        {tone === "full" && <span className="ml-1 font-medium text-destructive">· cheia</span>}
      </p>
      {percent !== null && (
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          role="meter"
          aria-label="Espaço usado"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent}%`}
        >
          <div
            className={cn("h-full rounded-full", tone === "full" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-primary")}
            style={{ width: `${Math.max(percent, 2)}%` }}
          />
        </div>
      )}
    </div>
  );
}

const choice =
  "group flex cursor-pointer items-start gap-3 rounded-lg border bg-field px-3 py-2.5 text-sm transition-colors hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50";

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background group-has-[:checked]:border-primary"
    >
      <span className="size-2 rounded-full bg-primary opacity-0 group-has-[:checked]:opacity-100" />
    </span>
  );
}

/** Generate (the default, shown once) or type a password, checked again on the server. */
export function PasswordChoice() {
  const [mode, setMode] = useState<"generate" | "type">("generate");
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-foreground">Senha</legend>
      <label className={choice}>
        <input type="radio" name="mode" value="generate" checked={mode === "generate"} onChange={() => setMode("generate")} className="sr-only" />
        <Dot />
        <span className="min-w-0">
          <span className="block font-medium text-foreground">Gerar uma senha forte</span>
          <span className="block text-xs text-muted-foreground">O Console cria a senha e mostra uma vez, para você copiar.</span>
        </span>
      </label>
      <label className={choice}>
        <input type="radio" name="mode" value="type" checked={mode === "type"} onChange={() => setMode("type")} className="sr-only" />
        <Dot />
        <span className="min-w-0">
          <span className="block font-medium text-foreground">Digitar a senha</span>
          <span className="block text-xs text-muted-foreground">Pelo menos {PASSWORD_MIN} caracteres. O servidor confere a força.</span>
        </span>
      </label>
      {mode === "type" && (
        <FormField label="Nova senha" htmlFor={`${id}-password`} className="mt-2">
          <div className="relative">
            <Input
              id={`${id}-password`}
              name="password"
              type={visible ? "text" : "password"}
              required
              minLength={PASSWORD_MIN}
              maxLength={128}
              autoComplete="new-password"
              spellCheck={false}
              autoFocus
              className="pr-10 font-mono"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={visible ? "Esconder a senha" : "Mostrar a senha"}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
          </div>
        </FormField>
      )}
    </fieldset>
  );
}

export type Secret = { address: string; password: string; title: string };

/**
 * A generated password, shown once: it lives only in this sheet's props and
 * is gone when it closes. The Console keeps no copy.
 */
export function SecretSheet({ secret, onClose }: { secret: Secret | null; onClose: () => void }) {
  return (
    <Sheet open={!!secret} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{secret?.title ?? "Senha"}</SheetTitle>
          <SheetDescription>Copie a senha e passe para quem usa a caixa por um canal seguro.</SheetDescription>
        </SheetHeader>
        {secret && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="grid gap-5">
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-warning-edge bg-warning-soft px-3 py-2.5 text-sm text-warning"
              >
                <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p>Guarde agora: ela não aparece de novo. Se perder, troque por outra.</p>
              </div>
              <FormField label="Usuário">
                <div className="flex min-w-0 items-center gap-1 rounded-lg border bg-field py-1 pr-1 pl-3">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">{secret.address}</span>
                  <CopyButton value={secret.address} label="Usuário" />
                </div>
              </FormField>
              <FormField label="Senha">
                <div className="flex min-w-0 items-center gap-1 rounded-lg border bg-field py-1 pr-1 pl-3">
                  <span className="min-w-0 flex-1 font-mono text-sm break-all select-all" data-secret="">
                    {secret.password}
                  </span>
                  <CopyButton value={secret.password} label="Senha" copiedText="Senha copiada." />
                </div>
              </FormField>
            </div>
          </div>
        )}
        <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4 sm:justify-end">
          <Button type="button" onClick={onClose}>
            Já guardei
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
