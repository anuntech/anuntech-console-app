"use client";
import { useState } from "react";
import { EyeIcon, MailIcon, MoreHorizontalIcon, ShieldCheckIcon, UserRoundXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FormField } from "@/components/console/form-field";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import {
  resendInvite,
  revokeCompanyMember,
  revokeConsoleStaffMember,
  saveCompanyMember,
  saveConsoleStaffMember,
} from "@/lib/access/members-actions";
import { EngagementScopeField, type MemberScope, type ScopeEngagement } from "./member-access-fields";
import { HelpLink } from "@/components/console/help-link";

/** The company permission picker; also used by the company page's "Liberar acesso". */
export function RoleSelect({
  id,
  defaultValue = "member",
  onValueChange,
}: {
  id?: string;
  defaultValue?: string;
  /** Lets the form show "O que esta pessoa vê" only for a Membro. */
  onValueChange?: (role: string) => void;
}) {
  return (
    <NativeSelect id={id} name="role" defaultValue={defaultValue} required onChange={(event) => onValueChange?.(event.target.value)}>
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
  engagements,
}: {
  companyId?: string;
  staff?: boolean;
  /** The company's products, services and projects, to choose what a Membro sees. */
  engagements?: ScopeEngagement[];
}) {
  const [role, setRole] = useState("member");
  const [choosing, setChoosing] = useState(false);
  return (
    <ServerForm
      action={staff ? saveConsoleStaffMember : saveCompanyMember}
      reset
      onSuccess={() => setChoosing(false)}
      className="flex flex-col gap-3"
    >
      {companyId && <input type="hidden" name="companyId" value={companyId} />}
      <FormError />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <FormField label="Convidar pessoa" htmlFor="invite-email" className="flex-1">
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            placeholder="nome@empresa.com.br"
          />
        </FormField>
        {!staff && (
          <FormField label="Permissão" htmlFor="invite-role" className="sm:w-72">
            <RoleSelect id="invite-role" onValueChange={setRole} />
          </FormField>
        )}
        <SubmitButton pendingLabel="Convidando…">Convidar pessoa</SubmitButton>
      </div>
      {!staff && engagements && role === "member" && (
        choosing ? (
          <div className="max-w-xl">
            <EngagementScopeField engagements={engagements} defaultValue={{ access: "selected", ids: [] }} />
          </div>
        ) : (
          <p className="m-0 text-xs text-muted-foreground">
            Um Membro vê todos os produtos, serviços e projetos da empresa.{" "}
            <button type="button" onClick={() => setChoosing(true)} className="font-medium text-primary underline-offset-4 hover:underline">
              Escolher o que ele vê
            </button>
          </p>
        )
      )}
      <p className="text-xs text-muted-foreground">
        {staff
          ? "A pessoa passa a administrar o Console inteiro e recebe um e-mail para entrar."
          : "A pessoa recebe um e-mail para entrar e aparece aqui como convidada até o primeiro acesso."}
        {!staff && (
          <>
            {" "}
            <HelpLink slug="membro-ou-administrador">Membro ou Administrador</HelpLink>
          </>
        )}
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
  engagements,
  scope,
}: {
  memberId: string;
  email: string;
  companyId?: string;
  role: string;
  pending: boolean;
  staff?: boolean;
  /** The company's products, services and projects; with them, a Membro's access can be narrowed. */
  engagements?: ScopeEngagement[];
  scope?: MemberScope;
}) {
  const [editing, setEditing] = useState(false);
  const [scoping, setScoping] = useState(false);
  const [editRole, setEditRole] = useState(role);
  const [revoking, setRevoking] = useState(false);
  const [resending, setResending] = useState(false);
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
            <DropdownMenuItem
              onSelect={() =>
                setTimeout(() => {
                  setEditRole(role);
                  setEditing(true);
                }, 0)
              }
            >
              <ShieldCheckIcon />
              Editar permissão
            </DropdownMenuItem>
          )}
          {!staff && engagements && role === "member" && (
            <DropdownMenuItem onSelect={() => setTimeout(() => setScoping(true), 0)}>
              <EyeIcon />
              O que esta pessoa vê
            </DropdownMenuItem>
          )}
          {!staff && (!pending || (engagements && role === "member")) && <DropdownMenuSeparator />}
          {!staff && pending && (
            <>
              <DropdownMenuItem onSelect={() => setTimeout(() => setResending(true), 0)}>
                <MailIcon />
                Reenviar convite
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
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
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
              <FormField label="Permissão" htmlFor={`role-${memberId}`}>
                <RoleSelect id={`role-${memberId}`} defaultValue={role} onValueChange={setEditRole} />
              </FormField>
              {engagements && editRole === "member" && <EngagementScopeField engagements={engagements} defaultValue={scope} />}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
              </DialogFooter>
            </ServerForm>
          </DialogContent>
        </Dialog>
      )}
      {!staff && companyId && engagements && role === "member" && (
        <Dialog open={scoping} onOpenChange={setScoping}>
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg">
            <ServerForm
              action={saveCompanyMember}
              onSuccess={() => setScoping(false)}
              className="flex min-h-0 flex-col gap-5"
            >
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="role" value="member" />
              <DialogHeader>
                <DialogTitle>O que esta pessoa vê</DialogTitle>
                <DialogDescription>{email}</DialogDescription>
              </DialogHeader>
              <FormError />
              <div className="-mx-1 min-h-0 overflow-y-auto px-1">
                <EngagementScopeField engagements={engagements} defaultValue={scope} hideLegend />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
              </DialogFooter>
            </ServerForm>
          </DialogContent>
        </Dialog>
      )}
      {!staff && (
        <ConfirmDialog
          open={resending}
          onOpenChange={setResending}
          action={resendInvite}
          fields={{ id: memberId }}
          title="Reenviar o convite?"
          description={`${email} ainda não entrou. Um novo convite sai agora; dá para reenviar uma vez por semana.`}
          confirmLabel="Reenviar"
        />
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
