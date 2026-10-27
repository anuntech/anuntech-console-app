"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/console/form-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { updateBookmark } from "@/lib/bookmarks/bookmark-actions";
import type { BookmarkView } from "@/lib/bookmarks/bookmarks";

/** "Renomear": only the title; the link, the folder and the file stay as they are. */
export function RenameDialog({ item, onClose }: { item: BookmarkView | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {item && (
          <ServerForm key={item.id} action={updateBookmark} onSuccess={onClose} className="flex flex-col gap-5">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="url" value={item.url ?? ""} />
            <input type="hidden" name="folderId" value={item.folderId ?? ""} />
            <DialogHeader>
              <DialogTitle>Renomear</DialogTitle>
              <DialogDescription>Só o nome muda{item.fileName ? `; o arquivo continua “${item.fileName}”` : ""}.</DialogDescription>
            </DialogHeader>
            <FormError />
            <FormField label="Nome" htmlFor="rename-title">
              <Input id="rename-title" name="title" defaultValue={item.title} required maxLength={160} autoFocus onFocus={(event) => event.currentTarget.select()} />
            </FormField>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
            </DialogFooter>
          </ServerForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
