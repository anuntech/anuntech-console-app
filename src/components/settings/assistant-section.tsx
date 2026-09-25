import "server-only";
import { desc } from "drizzle-orm";
import { CheckCircle2Icon, FileTextIcon, TriangleAlertIcon } from "lucide-react";
import { db } from "@/lib/db";
import { assistantDocuments, user } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { assistantConfig, DEFAULT_ASSISTANT_MODEL } from "@/lib/assistant";
import { assistantTools } from "@/lib/assistant-tools";
import { openRouterModels, SUGGESTED_MODEL_IDS } from "@/lib/openrouter-models";
import { ModelField } from "./model-field";
import { addAssistantDocument, removeAssistantDocument, saveAssistantSettings } from "@/lib/assistant-actions";
import { dateTimeLabel, fileSizeLabel } from "@/lib/format";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, SectionTitle } from "@/components/console/page-header";
import { ConfirmAction, FormError, ServerForm, SubmitButton } from "@/components/console/server-form";

export async function AssistantSection() {
  await requireAdmin();
  const [config, documents, models] = await Promise.all([
    assistantConfig(),
    db
      .select({ id: assistantDocuments.id, name: assistantDocuments.name, bytes: assistantDocuments.bytes, updatedAt: assistantDocuments.updatedAt, author: user.name })
      .from(assistantDocuments)
      .leftJoin(user, eq(user.id, assistantDocuments.authorId))
      .orderBy(desc(assistantDocuments.updatedAt)),
    openRouterModels(),
  ]);
  const totalBytes = documents.reduce((sum, d) => sum + d.bytes, 0);
  return (
    <>
      <Card>
        <CardHeader>
          <SectionTitle
            title="Modelo e instruções"
            description="O assistente fala pelo OpenRouter. As regras básicas (usar só o acesso da pessoa, não inventar, não criar cobranças) já estão no código; aqui você acrescenta o jeito da Anuntech."
          />
        </CardHeader>
        <ServerForm action={saveAssistantSettings} className="contents">
          <CardContent className="flex flex-col gap-5">
            <FormError />
            <p
              role="status"
              className={
                config.keyConfigured
                  ? "m-0 flex items-center gap-2 text-sm text-success"
                  : "m-0 flex items-start gap-2 rounded-lg border border-warning-edge bg-warning-soft px-4 py-3 text-sm text-warning"
              }
            >
              {config.keyConfigured ? <CheckCircle2Icon className="size-4 shrink-0" /> : <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />}
              <span>
                {config.keyConfigured
                  ? "Chave do OpenRouter configurada no ambiente."
                  : "Falta a variável OPENROUTER_API_KEY no projeto da Vercel. Até lá o assistente abre, mas avisa que está desligado."}
              </span>
            </p>
            <div>
              <Label htmlFor="assistant-model" className="mb-1.5">
                Modelo
              </Label>
              {models.length ? (
                <ModelField id="assistant-model" models={models} suggested={SUGGESTED_MODEL_IDS} defaultValue={config.model} />
              ) : (
                <Input id="assistant-model" name="model" defaultValue={config.model} placeholder={DEFAULT_ASSISTANT_MODEL} maxLength={120} className="font-mono text-[13px]" />
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {models.length
                  ? `Lista ao vivo do OpenRouter, só modelos que aceitam ferramentas, com o preço por milhão de tokens (entrada / saída). Em branco, usa ${DEFAULT_ASSISTANT_MODEL}.`
                  : `Não deu para carregar a lista do OpenRouter agora. Digite o id como aparece em openrouter.ai/models; precisa aceitar ferramentas. Em branco, usa ${DEFAULT_ASSISTANT_MODEL}.`}
              </p>
            </div>
            <div>
              <Label htmlFor="assistant-prompt" className="mb-1.5">
                Instruções da Anuntech
              </Label>
              <Textarea
                id="assistant-prompt"
                name="prompt"
                rows={10}
                maxLength={20000}
                defaultValue={config.prompt}
                placeholder={"Ex.: Trate o cliente por você. Horário de atendimento: dias úteis, 9h às 18h. Prazos de suporte: até 1 dia útil para responder chamados…"}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Tom de voz, horários, políticas e o que dizer em cada situação. Entra em toda conversa.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-between gap-3 border-t">
            <span className="text-xs text-muted-foreground">{config.updatedAt ? `Atualizado em ${dateTimeLabel(config.updatedAt)}` : "Ainda com os padrões."}</span>
            <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
          </CardFooter>
        </ServerForm>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle
            title="Base de conhecimento"
            description="Textos que o assistente lê para responder sobre a Anuntech: quem somos, produtos, políticas, perguntas frequentes. Até 30 documentos de 300 KB, em .md, .txt ou .csv."
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {documents.length ? (
            <ul className="m-0 flex list-none flex-col divide-y p-0">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <FileTextIcon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-medium text-foreground">{doc.name}</p>
                    <p className="m-0 text-xs text-muted-foreground">
                      {fileSizeLabel(doc.bytes)} · {dateTimeLabel(doc.updatedAt)}
                      {doc.author && ` · ${doc.author}`}
                    </p>
                  </div>
                  <ConfirmAction
                    action={removeAssistantDocument}
                    fields={{ id: doc.id }}
                    title={`Remover "${doc.name}"?`}
                    description="O assistente deixa de usar este texto na hora."
                    confirmLabel="Remover"
                    destructive
                  >
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                      Remover
                    </Button>
                  </ConfirmAction>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<FileTextIcon />}
              title="Nenhum documento ainda"
              description="Sem base, o assistente responde só com o que vê no Console e encaminha dúvidas sobre a Anuntech ao chat da equipe."
            />
          )}
          <ServerForm action={addAssistantDocument} reset className="flex flex-col gap-4 rounded-lg border bg-field/40 p-4">
            <p className="m-0 text-sm font-medium text-foreground">Adicionar documento</p>
            <FormError />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="assistant-doc-name" className="mb-1.5">
                  Nome
                </Label>
                <Input id="assistant-doc-name" name="name" maxLength={120} placeholder="Ex.: Perguntas frequentes sobre suporte" />
              </div>
              <div>
                <Label htmlFor="assistant-doc-file" className="mb-1.5">
                  Arquivo (.md, .txt, .csv)
                </Label>
                <Input id="assistant-doc-file" name="file" type="file" accept=".md,.markdown,.txt,.csv,text/plain,text/markdown,text/csv" className="pt-1.5" />
              </div>
            </div>
            <div>
              <Label htmlFor="assistant-doc-content" className="mb-1.5">
                Ou cole o texto
              </Label>
              <Textarea id="assistant-doc-content" name="content" rows={5} placeholder="Markdown ou texto simples. Parágrafos separados por linha em branco ajudam a busca." />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {documents.length} {documents.length === 1 ? "documento" : "documentos"} · {fileSizeLabel(totalBytes)}
                {totalBytes > 24000 && " · acima de 24 KB o assistente busca trechos em vez de ler tudo"}
              </span>
              <SubmitButton pendingLabel="Adicionando…">Adicionar</SubmitButton>
            </div>
          </ServerForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle
            title={`Ferramentas (${assistantTools.length})`}
            description="Cada uma é uma ação do Console que o assistente pode chamar, sempre com as permissões da pessoa logada; o que altera dados passa pela checagem de confirmação e fica no histórico como se ela mesma tivesse feito. A cada mensagem, o Jev lê que áreas ela toca e o modelo recebe só as ferramentas dessas áreas, além das listagens e da navegação. Emitir cobranças, enviar orçamentos e contratos e remover acessos continuam só na tela."
          />
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {(
            [
              ["Consultas", assistantTools.filter((t) => !t.write)],
              ["Ações", assistantTools.filter((t) => t.write)],
            ] as const
          ).map(([title, tools]) => (
            <div key={title}>
              <p className="m-0 mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {title} · {tools.length}
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {tools.map((t) => (
                  <li key={t.name} className="text-sm">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <code className="rounded bg-secondary px-1 py-0.5 text-[12px]">{t.name}</code>
                      {t.staffOnly && <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-medium text-primary">equipe</span>}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{t.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
