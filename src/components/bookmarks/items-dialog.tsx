"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormField } from "@/components/console/form-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { copyBookmark, moveBookmarks } from "@/lib/bookmarks/bookmark-actions";
import { treeOrder } from "@/lib/bookmarks/folder-tree";
import type { FolderView } from "@/lib/bookmarks/bookmarks";

/** "Mover para…" on the selection, or "Copiar para…" on one item. */
export type ItemsMove = { mode: "move" | "copy"; ids: string[]; title: string; companyId: string | null };

/**
 * Where items go: a folder of the same company (and "Sem pasta" there), or,
 * for a copy, any folder the person sees, of any of their companies.
 */
export function ItemsDialog({
  target,
  folders,
  companyName,
  onClose,
}: {
  target: ItemsMove | null;
  folders: FolderView[];
  companyName: Map<string, string>;
  onClose: () => void;
}) {
  const copy = target?.mode === "copy";
  const choices = treeOrder(
    folders.map((f) => ({ ...f, parentId: f.parentId ?? null })).filter((f) => copy || (f.companyId ?? null) === (target?.companyId ?? null)),
  );
  const many = new Set(choices.map((f) => f.companyId ?? "")).size > 1;
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {target && (
          <ServerForm key={`${target.mode}-${target.ids.join()}`} action={copy ? copyBookmark : moveBookmarks} onSuccess={onClose} className="flex flex-col gap-5">
            {target.ids.map((id) => (
              <input key={id} type="hidden" name="id" value={id} />
            ))}
            <DialogHeader>
              <DialogTitle>{copy ? `Copiar “${target.title}”` : `Mover ${target.title}`}</DialogTitle>
              <DialogDescription>
                {copy
                  ? "Uma cópia vai para a pasta escolhida; o original fica onde está. Um arquivo copiado ocupa o espaço da empresa de destino."
                  : "Quem vê cada item passa a seguir a pasta de destino."}
              </DialogDescription>
            </DialogHeader>
            <FormError />
            <FormField label="Para" htmlFor="items-to">
              <NativeSelect id="items-to" name="folderId" defaultValue="">
                <NativeSelectOption value="">Sem pasta{copy ? " (na mesma empresa)" : ""}</NativeSelectOption>
                {choices.map((f) => (
                  <NativeSelectOption key={f.id} value={f.id}>
                    {"— ".repeat(f.depth)}
                    {f.name}
                    {many ? ` · ${f.companyId ? (companyName.get(f.companyId) ?? "Empresa") : "Anuntech"}` : ""}
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
              <SubmitButton pendingLabel={copy ? "Copiando…" : "Movendo…"}>{copy ? "Copiar" : "Mover"}</SubmitButton>
            </DialogFooter>
          </ServerForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
