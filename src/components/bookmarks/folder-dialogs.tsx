"use client";
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
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { PeopleField, type PersonOption } from "@/components/console/people-field";
import { createFolder, deleteFolder, renameFolder, shareFolder } from "@/lib/bookmark-actions";
import type { FolderView } from "@/lib/bookmarks";

export type FolderEditor =
  | { mode: "create" }
  | { mode: "rename"; folder: FolderView }
  | { mode: "share"; folder: FolderView }
  | { mode: "delete"; folder: FolderView };

/** Small dialogs for a folder: name it, share it, let it go. */
export function FolderDialogs({
  editor,
  onClose,
  people,
}: {
  editor: FolderEditor | null;
  onClose: () => void;
  people: PersonOption[];
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
                {folder ? "Só o nome muda." : "Reúna bookmarks e compartilhe com quem precisar."}
              </DialogDescription>
            </DialogHeader>
            <FormError />
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

      <Dialog open={editor?.mode === "share"} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <ServerForm
            key={folder?.id ?? "share"}
            action={shareFolder}
            onSuccess={onClose}
            className="flex flex-col gap-5"
          >
            {folder && <input type="hidden" name="id" value={folder.id} />}
            <DialogHeader>
              <DialogTitle>Compartilhar “{folder?.name}”</DialogTitle>
              <DialogDescription>
                Quem recebe a pasta vê tudo nela e pode adicionar bookmarks. Você continua dono.
              </DialogDescription>
            </DialogHeader>
            <FormError />
            <div>
              <Label htmlFor="folder-people" className="mb-1.5">
                Pessoas
              </Label>
              {people.length ? (
                <PeopleField
                  id="folder-people"
                  name="userIds"
                  people={people}
                  defaultValue={folder?.sharedWith.map((person) => person.id) ?? []}
                  placeholder="Ninguém ainda"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ainda não há outras pessoas com acesso ao Console para compartilhar.
                </p>
              )}
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

      {folder && (
        <ConfirmDialog
          open={editor?.mode === "delete"}
          onOpenChange={(open) => !open && onClose()}
          action={deleteFolder}
          fields={{ id: folder.id }}
          title={`Excluir “${folder.name}”?`}
          description="Os bookmarks não são apagados: voltam para “Sem pasta” de quem os criou."
          confirmLabel="Excluir pasta"
          destructive
          onSuccess={onClose}
        />
      )}
    </>
  );
}
