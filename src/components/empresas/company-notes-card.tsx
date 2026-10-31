"use client";
import { useState } from "react";
import { PencilIcon, StickyNoteIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/console/page-header";
import { ConfirmDialog, FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { addCompanyNote, deleteCompanyNote, updateCompanyNote } from "@/lib/companies/company-notes";
import { relativeLabel } from "@/lib/format";

export type CompanyNote = { id: string; body: string; author: string | null; createdAt: string; updatedAt: string | null };

/**
 * Anotações: what the team keeps about this client, newest first. Internal: the client never sees
 * them, in the Console or in the app.
 */
export function CompanyNotesCard({ companyId, notes, now }: { companyId: string; notes: CompanyNote[]; now: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CompanyNote | null>(null);
  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Anotações" description="Internas: só a equipe Anuntech vê." />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ServerForm action={addCompanyNote} reset className="flex flex-col gap-2">
          <input type="hidden" name="companyId" value={companyId} />
          <FormError />
          <Textarea
            name="body"
            required
            maxLength={5000}
            rows={3}
            aria-label="Nova anotação"
            placeholder="Como prefere ser atendido, quem decide, o que foi combinado…"
          />
          <SubmitButton size="sm" className="self-end" pendingLabel="Salvando…">
            Adicionar
          </SubmitButton>
        </ServerForm>
        {notes.length === 0 ? (
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
            <StickyNoteIcon className="size-4" />
            Nenhuma anotação ainda.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y p-0">
            {notes.map((note) => (
              <li key={note.id} className="py-3 first:pt-0 last:pb-0">
                {editing === note.id ? (
                  <ServerForm action={updateCompanyNote} onSuccess={() => setEditing(null)} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={note.id} />
                    <FormError />
                    <Textarea name="body" required maxLength={5000} rows={3} defaultValue={note.body} aria-label="Editar anotação" autoFocus />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
                        Cancelar
                      </Button>
                      <SubmitButton size="sm" pendingLabel="Salvando…">
                        Salvar
                      </SubmitButton>
                    </div>
                  </ServerForm>
                ) : (
                  <div className="group/note flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm break-words whitespace-pre-wrap text-foreground">{note.body}</p>
                      <p className="m-0 mt-1 text-xs text-muted-foreground">
                        {note.author ?? "Equipe"} · {relativeLabel(note.createdAt, now)}
                        {note.updatedAt ? " · editada" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/note:opacity-100 sm:focus-within:opacity-100">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar anotação" onClick={() => setEditing(note.id)}>
                        <PencilIcon />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Excluir anotação" onClick={() => setRemoving(note)}>
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        action={deleteCompanyNote}
        fields={{ id: removing?.id ?? "" }}
        title="Excluir esta anotação?"
        description="Ela sai da página da empresa. Não dá para desfazer."
        confirmLabel="Excluir"
        destructive
        onSuccess={() => setRemoving(null)}
      />
    </Card>
  );
}
