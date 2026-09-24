"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { saveBookmark, updateBookmark } from "@/lib/bookmark-actions";
import type { BookmarkView, FolderView } from "@/lib/bookmarks";

export type BookmarkEditor =
  | { mode: "create"; folderId: string }
  | { mode: "edit"; item: BookmarkView };

/** Create or edit: title, link (or a small file when creating) and folder. */
export function BookmarkSheet({
  editor,
  onClose,
  folders,
}: {
  editor: BookmarkEditor | null;
  onClose: () => void;
  folders: FolderView[];
}) {
  const item = editor?.mode === "edit" ? editor.item : null;
  const folderId = editor?.mode === "create" ? editor.folderId : (item?.folderId ?? "");
  return (
    <Sheet open={editor !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <ServerForm
          key={item?.id ?? `new-${folderId}`}
          action={item ? updateBookmark : saveBookmark}
          onSuccess={onClose}
          className="flex h-full min-h-0 flex-col"
        >
          {item && <input type="hidden" name="id" value={item.id} />}
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{item ? "Editar bookmark" : "Novo bookmark"}</SheetTitle>
            <SheetDescription>
              {item?.fileName ? `Arquivo: ${item.fileName}` : "Um link, ou um arquivo de até 1 MB."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <div className="grid gap-5">
              <div>
                <Label htmlFor="bookmark-title" className="mb-1.5">
                  Título
                </Label>
                <Input
                  id="bookmark-title"
                  name="title"
                  required
                  maxLength={160}
                  autoFocus
                  defaultValue={item?.title ?? ""}
                  placeholder="Ex.: Identidade visual no Drive"
                />
              </div>
              {!item?.fileName && (
                <div>
                  <Label htmlFor="bookmark-url" className="mb-1.5">
                    Link
                  </Label>
                  <Input
                    id="bookmark-url"
                    name="url"
                    type="url"
                    inputMode="url"
                    maxLength={2048}
                    defaultValue={item?.url ?? ""}
                    placeholder="https://"
                  />
                </div>
              )}
              {!item && (
                <div>
                  <Label htmlFor="bookmark-file" className="mb-1.5">
                    Ou um arquivo
                  </Label>
                  <Input id="bookmark-file" name="file" type="file" className="pt-1.5" />
                </div>
              )}
              <div>
                <Label htmlFor="bookmark-folder" className="mb-1.5">
                  Pasta
                </Label>
                <NativeSelect
                  id="bookmark-folder"
                  name="folderId"
                  defaultValue={folderId}
                  className="bg-field"
                >
                  <NativeSelectOption value="">Sem pasta</NativeSelectOption>
                  {folders.map((folder) => (
                    <NativeSelectOption key={folder.id} value={folder.id}>
                      {folder.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Salvando…">{item ? "Salvar" : "Adicionar"}</SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}
