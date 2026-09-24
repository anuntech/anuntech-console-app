"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createFolder, deleteFolder, renameFolder, shareFolder } from "@/lib/bookmark-actions";
import type { FolderView } from "@/lib/bookmarks";
import { SharePeoplePicker } from "./share-people-picker";

export type { CompanyOption };
export type FolderEditor =
  | { mode: "create" }
  | { mode: "rename"; folder: FolderView }
  | { mode: "share"; folder: FolderView }
  | { mode: "delete"; folder: FolderView };

function VisibilitySelect({
  id,
  defaultValue,
  onChange,
}: {
  id: string;
  defaultValue: "company" | "people";
  onChange?: (value: "company" | "people") => void;
}) {
  return (
    <NativeSelect
      id={id}
      name="visibility"
      defaultValue={defaultValue}
      className="bg-field"
      onChange={(event) => onChange?.(event.target.value as "company" | "people")}
    >
      <NativeSelectOption value="company">Todos da empresa</NativeSelectOption>
      <NativeSelectOption value="people">Só pessoas escolhidas</NativeSelectOption>
    </NativeSelect>
  );
}

/** Visibility plus, when restricted, the people; state starts from the folder. */
function ShareForm({ folder, onClose }: { folder: FolderView; onClose: () => void }) {
  const [mode, setMode] = useState<"company" | "people">(folder.visibility);
  return (
    <ServerForm action={shareFolder} onSuccess={onClose} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={folder.id} />
      <DialogHeader>
        <DialogTitle>Compartilhar “{folder.name}”</DialogTitle>
        <DialogDescription>Quem vê a pasta também pode adicionar bookmarks nela.</DialogDescription>
      </DialogHeader>
      <FormError />
      <div>
        <Label htmlFor="share-visibility" className="mb-1.5">
          Quem vê
        </Label>
        <VisibilitySelect id="share-visibility" defaultValue={folder.visibility} onChange={setMode} />
      </div>
      {mode === "people" && (
        <div>
          <Label className="mb-1.5">Pessoas</Label>
          <SharePeoplePicker folderId={folder.id} initial={folder.sharedWith} />
        </div>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
      </DialogFooter>
    </ServerForm>
  );
}

/** Small dialogs for a folder: name it, decide who sees it, let it go. */
export function FolderDialogs({
  editor,
  onClose,
  companies,
  defaultCompany,
}: {
  editor: FolderEditor | null;
  onClose: () => void;
  /** Where a new folder can live; id "" is Anuntech's own space. */
  companies: CompanyOption[];
  defaultCompany: string;
}) {
  const folder = editor && editor.mode !== "create" ? editor.folder : null;
  const naming = editor?.mode === "create" || editor?.mode === "rename";
  return (
    <>
      <Dialog open={naming} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-sm">
          <ServerForm
            key={folder?.id ?? "new"}
            action={folder ? renameFolder : createFolder}
            onSuccess={onClose}
            className="flex flex-col gap-5"
          >
            {folder && <input type="hidden" name="id" value={folder.id} />}
            <DialogHeader>
              <DialogTitle>{folder ? "Renomear pasta" : "Nova pasta"}</DialogTitle>
              <DialogDescription>
                {folder ? "Só o nome muda." : "Reúna os bookmarks de uma empresa."}
              </DialogDescription>
            </DialogHeader>
            <FormError />
            {!folder &&
              (companies.length > 1 ? (
                <div>
                  <Label htmlFor="folder-company" className="mb-1.5">
                    Empresa
                  </Label>
                  <CompanyField
                    id="folder-company"
                    name="companyId"
                    companies={companies}
                    defaultValue={defaultCompany}
                  />
                </div>
              ) : (
                <input type="hidden" name="companyId" value={companies[0]?.id ?? ""} />
              ))}
            <div>
              <Label htmlFor="folder-name" className="mb-1.5">
                Nome
              </Label>
              <Input
                id="folder-name"
                name="name"
                required
                maxLength={80}
                autoFocus
                defaultValue={folder?.name ?? ""}
                placeholder="Ex.: Referências de design"
              />
            </div>
            {!folder && (
              <div>
                <Label htmlFor="folder-visibility" className="mb-1.5">
                  Quem vê
                </Label>
                <VisibilitySelect id="folder-visibility" defaultValue="company" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Pessoas escolhidas você define depois, em Compartilhar.
                </p>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <SubmitButton pendingLabel="Salvando…">{folder ? "Salvar" : "Criar pasta"}</SubmitButton>
            </DialogFooter>
          </ServerForm>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editor?.mode === "share"}
        onOpenChange={(open) => {
          if (open) return;
          onClose();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {folder && <ShareForm key={folder.id} folder={folder} onClose={onClose} />}
        </DialogContent>
      </Dialog>

      {folder && (
        <ConfirmDialog
          open={editor?.mode === "delete"}
          onOpenChange={(open) => !open && onClose()}
          action={deleteFolder}
          fields={{ id: folder.id }}
          title={`Excluir “${folder.name}”?`}
          description="Os bookmarks não são apagados: continuam na empresa, em “Sem pasta”."
          confirmLabel="Excluir pasta"
          destructive
          onSuccess={onClose}
        />
      )}
    </>
  );
}
