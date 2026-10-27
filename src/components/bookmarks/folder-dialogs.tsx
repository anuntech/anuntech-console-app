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
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { FormField } from "@/components/console/form-field";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createFolder, deleteFolder, moveFolder, renameFolder, shareFolder } from "@/lib/bookmarks/bookmark-actions";
import { moveRefusal } from "@/lib/bookmarks/folder-tree";
import type { FolderView } from "@/lib/bookmarks/bookmarks";
import { SharePeoplePicker } from "./share-people-picker";

export type { CompanyOption };
export type FolderEditor =
  /** `parent`: the new folder goes inside it (and sees what it sees). */
  | { mode: "create"; parent?: FolderView }
  | { mode: "move"; folder: FolderView }
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
        <DialogDescription>Quem vê e o que pode fazer. Quem você incluir recebe um aviso por e-mail.</DialogDescription>
      </DialogHeader>
      <FormError />
      <div className="grid gap-5">
        <FormField label="Quem vê" htmlFor="share-visibility">
          <VisibilitySelect id="share-visibility" defaultValue={folder.visibility} onChange={setMode} />
        </FormField>
        {mode === "people" && (
          <FormField label="Pessoas" htmlFor="share-people">
            <SharePeoplePicker id="share-people" folderId={folder.id} initial={folder.sharedWith} />
          </FormField>
        )}
        <FormField label="Quem vê pode" htmlFor="share-adds">
          <NativeSelect id="share-adds" name="adds" defaultValue={folder.adds ?? "viewers"}>
            <NativeSelectOption value="viewers">Ver, baixar e adicionar itens</NativeSelectOption>
            <NativeSelectOption value="owner">Só ver e baixar</NativeSelectOption>
          </NativeSelect>
        </FormField>
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
  );
}

/** Small dialogs for a folder: name it, decide who sees it, let it go. */
export function FolderDialogs({
  editor,
  onClose,
  companies,
  defaultCompany,
  folders = [],
}: {
  editor: FolderEditor | null;
  onClose: () => void;
  /** Every folder the viewer sees, in tree order: where one can move. */
  folders?: (FolderView & { depth: number })[];
  /** Where a new folder can live; id "" is Anuntech's own space. */
  companies: CompanyOption[];
  defaultCompany: string;
}) {
  const folder = editor && editor.mode !== "create" ? editor.folder : null;
  const parent = editor?.mode === "create" ? editor.parent : undefined;
  const naming = editor?.mode === "create" || editor?.mode === "rename";
  // Where a folder can go: the top, or another folder of its company that is not itself or below it.
  const tree = folders.map((f) => ({ id: f.id, parentId: f.parentId ?? null, companyId: f.companyId, name: f.name }));
  const destinations = editor?.mode === "move" ? folders.filter((f) => !moveRefusal(tree, editor.folder.id, f.id)) : [];
  return (
    <>
      <Dialog open={naming} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <ServerForm
            key={folder?.id ?? `new-${parent?.id ?? ""}`}
            action={folder ? renameFolder : createFolder}
            onSuccess={onClose}
            className="flex flex-col gap-5"
          >
            {folder && <input type="hidden" name="id" value={folder.id} />}
            <DialogHeader>
              <DialogTitle>{folder ? "Renomear pasta" : "Nova pasta"}</DialogTitle>
              <DialogDescription>
                {folder
                  ? "Só o nome muda."
                  : parent
                    ? `Dentro de “${parent.name}”. Quem vê segue a pasta de cima.`
                    : "Reúna os arquivos e links de uma empresa."}
              </DialogDescription>
            </DialogHeader>
            <FormError />
            <div className="grid gap-5">
              {parent && <input type="hidden" name="parentId" value={parent.id} />}
              {!folder &&
                !parent &&
                (companies.length > 1 ? (
                  <FormField label="Empresa" htmlFor="folder-company">
                    <CompanyField
                      id="folder-company"
                      name="companyId"
                      companies={companies}
                      defaultValue={defaultCompany}
                    />
                  </FormField>
                ) : (
                  <input type="hidden" name="companyId" value={companies[0]?.id ?? ""} />
                ))}
              <FormField label="Nome" htmlFor="folder-name">
                <Input
                  id="folder-name"
                  name="name"
                  required
                  maxLength={80}
                  autoFocus
                  defaultValue={folder?.name ?? ""}
                  placeholder="Ex.: Referências de design"
                />
              </FormField>
              {!folder && !parent && (
                <FormField
                  label="Quem vê"
                  htmlFor="folder-visibility"
                  hint="Pessoas escolhidas você define depois, em Compartilhar."
                >
                  <VisibilitySelect id="folder-visibility" defaultValue="company" />
                </FormField>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <SubmitButton pendingLabel={folder ? "Salvando…" : "Criando…"}>
                {folder ? "Salvar" : "Criar pasta"}
              </SubmitButton>
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

      <Dialog open={editor?.mode === "move"} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          {editor?.mode === "move" && (
            <ServerForm key={editor.folder.id} action={moveFolder} onSuccess={onClose} className="flex flex-col gap-5">
              <input type="hidden" name="id" value={editor.folder.id} />
              <DialogHeader>
                <DialogTitle>Mover “{editor.folder.name}”</DialogTitle>
                <DialogDescription>Vai com tudo o que tem dentro. Quem vê passa a seguir a pasta de destino.</DialogDescription>
              </DialogHeader>
              <FormError />
              <FormField label="Para" htmlFor="folder-move-to">
                <NativeSelect id="folder-move-to" name="parentId" defaultValue={editor.folder.parentId ?? ""}>
                  <NativeSelectOption value="">Início (fora de outras pastas)</NativeSelectOption>
                  {destinations.map((f) => (
                    <NativeSelectOption key={f.id} value={f.id}>
                      {"— ".repeat(f.depth)}
                      {f.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <SubmitButton pendingLabel="Movendo…">Mover</SubmitButton>
              </DialogFooter>
            </ServerForm>
          )}
        </DialogContent>
      </Dialog>

      {folder && (
        <ConfirmDialog
          open={editor?.mode === "delete"}
          onOpenChange={(open) => !open && onClose()}
          action={deleteFolder}
          fields={{ id: folder.id }}
          title={`Excluir “${folder.name}”?`}
          description={
            folder.parentId
              ? "Nada é apagado: os arquivos e as pastas de dentro vão para a pasta de cima."
              : "Nada é apagado: os arquivos vão para “Sem pasta” e as pastas de dentro sobem para o início."
          }
          confirmLabel="Excluir pasta"
          destructive
          onSuccess={onClose}
        />
      )}
    </>
  );
}
