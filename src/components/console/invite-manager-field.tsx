"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Inside a send dialog when the company has no Administrador: who gets
 * access to sign or answer. Tied to the dialog's form by `form`.
 */
export function InviteManagerField({ formId, suggestion }: { formId: string; suggestion: string }) {
  return (
    <div className="grid gap-1.5 rounded-lg border border-warning-edge bg-warning-soft px-3 py-3">
      <Label htmlFor={`${formId}-invite`} className="text-sm font-medium text-foreground">
        Ninguém da empresa é Administrador
      </Label>
      <Input id={`${formId}-invite`} form={formId} name="inviteEmail" type="email" defaultValue={suggestion} placeholder="email@empresa.com.br" />
      <p className="m-0 text-xs text-muted-foreground">
        Quem você indicar recebe acesso ao Console como Administrador: assina contratos, responde orçamentos e vê as faturas da empresa. Confira se é a pessoa certa. Em branco, o envio sai sem avisar ninguém.
      </p>
    </div>
  );
}
