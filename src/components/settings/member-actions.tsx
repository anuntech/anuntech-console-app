"use client";
import { useState } from "react";
import { MoreHorizontalIcon, ShieldCheckIcon, UserRoundXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import {
  revokeCompanyMember,
  revokeConsoleStaffMember,
  saveCompanyMember,
  saveConsoleStaffMember,
} from "@/lib/members-actions";

export function RoleSelect({
  id,
  defaultValue = "member",
}: {
  id?: string;
  defaultValue?: string;
}) {
  return (
    <NativeSelect id={id} name="role" defaultValue={defaultValue} required className="bg-field">
      <NativeSelectOption value="member">Membro — chamados, bookmarks e projetos</NativeSelectOption>
      <NativeSelectOption value="manager">Administrador — tudo, inclusive financeiro</NativeSelectOption>
    </NativeSelect>
  );
}

/**
 * Inviting stays on the page as a short row: an e-mail, a permission, one
 * button. The invite e-mail goes out on its own.
 */
export function InviteForm({
  companyId,
  staff = false,
}: {
  companyId?: string;
  staff?: boolean;
}) {
  return (
    <ServerForm
      action={staff ? saveConsoleStaffMember : saveCompanyMember}
      reset
      className="flex flex-col gap-3"
    >
      {companyId && <input type="hidden" name="companyId" value={companyId} />}
      <FormError />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Label htmlFor="invite-email" className="mb-1.5">
            Convidar pessoa
          </Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            placeholder="nome@empresa.com.br"
          />
        </div>
        {!staff && (
          <div className="sm:w-72">
            <Label htmlFor="invite-role" className="mb-1.5">
              Permissão
            </Label>
            <RoleSelect id="invite-role" />
          </div>
        )}
        <SubmitButton pendingLabel="Convidando…">Convidar pessoa</SubmitButton>
      </div>
      <p className="text-xs text-muted-foreground">
        {staff
          ? "A pessoa passa a administrar o Console inteiro e recebe um e-mail para entrar."
          : "A pessoa recebe um e-mail para entrar e aparece aqui como convidada até o primeiro acesso."}
      </p>
    </ServerForm>
  );
}

export function MemberMenu({
  memberId,
  email,
  companyId,
  role,
  pending,
  staff = false,
}: {
  memberId: string;
  email: string;
  companyId?: string;
  role: string;
  pending: boolean;
  staff?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${email}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!staff && !pending && (
            <>
              <DropdownMenuItem onSelect={() => setTimeout(() => setEditing(true), 0)}>
                <ShieldCheckIcon />
                Editar permissão
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setTimeout(() => setRevoking(true), 0)}
          >
            <UserRoundXIcon />
            {pending ? "Cancelar convite" : "Remover acesso"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!staff && companyId && (
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent className="sm:max-w-md">
            <ServerForm
              action={saveCompanyMember}
              onSuccess={() => setEditing(false)}
              className="flex flex-col gap-5"
            >
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="email" value={email} />
              <DialogHeader>
                <DialogTitle>Editar permissão</DialogTitle>
                <DialogDescription>{email}</DialogDescription>
              </DialogHeader>
              <FormError />
              <div>
                <Label htmlFor={`role-${memberId}`} className="mb-1.5">
                  Permissão
                </Label>
                <RoleSelect id={`role-${memberId}`} defaultValue={role} />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <SubmitButton pendingLabel="Salvando…">Salvar permissão</SubmitButton>
              </DialogFooter>
            </ServerForm>
          </DialogContent>
        </Dialog>
      )}
      <ConfirmDialog
        open={revoking}
        onOpenChange={setRevoking}
        action={staff ? revokeConsoleStaffMember : revokeCompanyMember}
        fields={{ id: memberId }}
        title={pending ? "Cancelar este convite?" : "Remover este acesso?"}
        description={`${email} ${pending ? "não poderá mais entrar com este convite." : "perde o acesso ao ambiente. Os registros são preservados."}`}
        confirmLabel={pending ? "Cancelar convite" : "Remover acesso"}
        destructive
      />
    </>
  );
}
