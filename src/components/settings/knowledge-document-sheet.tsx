"use client";
import { useState, type ReactNode } from "react";
import { ClipboardTypeIcon, FileUpIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentField } from "@/components/console/attachment-field";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { addAssistantDocument } from "@/lib/assistant-actions";
import { KNOWLEDGE_DOCUMENT } from "@/lib/attachment-rules";

type Source = "file" | "text";
const SOURCES: { value: Source; label: string; hint: string; icon: ReactNode }[] = [
  { value: "file", label: "Arquivo", hint: `Envie um ${KNOWLEDGE_DOCUMENT.acceptLabel}`, icon: <FileUpIcon /> },
  { value: "text", label: "Texto", hint: "Cole markdown ou texto simples", icon: <ClipboardTypeIcon /> },
];

/** "Novo documento" in the knowledge-base card, and the sheet it opens. */
export function NewKnowledgeDocument() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon />
        Novo documento
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        size="xl"
        title="Novo documento"
        description="Um texto que o assistente lê para responder sobre a Anuntech."
        action={addAssistantDocument}
        submitLabel="Adicionar documento"
        pendingLabel="Adicionando…"
      >
        <DocumentFields />
      </FormSheet>
    </>
  );
}

function DocumentFields() {
  const [source, setSource] = useState<Source>("file");
  return (
    <>
      <FormField
        label="Nome"
        htmlFor="assistant-doc-name"
        hint={source === "file" ? "Em branco, usa o nome do arquivo." : undefined}
      >
        <Input
          id="assistant-doc-name"
          name="name"
          maxLength={120}
          required={source === "text"}
          autoFocus
          placeholder="Ex.: Perguntas frequentes sobre suporte"
        />
      </FormField>
      {/* The action reads the file first; only one of the two is sent. */}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-foreground">Conteúdo</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SOURCES.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border bg-field px-3 py-2.5 text-sm transition-colors hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
            >
              <input
                type="radio"
                name="source"
                value={option.value}
                className="sr-only"
                checked={source === option.value}
                onChange={() => setSource(option.value)}
              />
              <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{option.icon}</span>
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {source === "file" ? (
        <FormField label="Arquivo" htmlFor="assistant-doc-file">
          <AttachmentField id="assistant-doc-file" name="file" rules={KNOWLEDGE_DOCUMENT} />
        </FormField>
      ) : (
        <FormField
          label="Texto"
          htmlFor="assistant-doc-content"
          hint="Parágrafos separados por linha em branco ajudam a busca."
        >
          <Textarea
            id="assistant-doc-content"
            name="content"
            required
            rows={12}
            placeholder="Markdown ou texto simples."
          />
        </FormField>
      )}
    </>
  );
}
