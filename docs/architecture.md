# Arquitetura

Como o Console é montado: stack, pastas, dados, acesso, integrações, rotinas e testes. As regras de trabalho estão em [rules.md](rules.md); o visual, em [design.md](design.md).

## Stack

| Camada | Escolha |
| --- | --- |
| Aplicação | Next.js 16.3 (App Router, Server Components, Server Actions), React 19.2, TypeScript 5 |
| Interface | Tailwind CSS v4, shadcn (new-york) sobre Radix e Base UI, Lucide, Sonner |
| Banco | PostgreSQL no Neon, Drizzle ORM 0.45, migrações SQL em `drizzle/` |
| Autenticação | Better Auth 1.7: código por e-mail, código por WhatsApp, Google e verificação em duas etapas |
| Validação | Zod 4 |
| Arquivos | Vercel Blob privado (fotos de perfil); anexos no próprio banco |
| PDFs | PDFKit no servidor, fontes Noto Sans em `assets/fonts` |
| Hospedagem | Vercel (Fluid Compute, Node 24), domínio console.anuntech.com |

## Pastas

```
src/
  app/                 rotas (páginas, route handlers, layouts, estados de erro)
    (secure)/          tudo que exige sessão; layout com dock e assistente
      @ticket/         slot paralelo: criação em painel lateral sobre a tela atual
    api/               route handlers (downloads, uploads, crons, assistente, auth)
    pagar/[publicId]/  página pública de pagamento
    entrar/, verificar-acesso/, acesso-pendente/
    dev/preview/       vitrine de componentes com dados fictícios (404 em produção)
  components/
    ui/                primitivos shadcn (não editar à mão sem motivo)
    console/           padrões do Console: cabeçalho, listas, formulários, campos, estados
    shell/             moldura do app: dock, barra do celular, provedores, notificações
    assistant/         painel do assistente
    auth/              telas de entrada e desafios de segurança
    <domínio>/         empresas, chamados, financeiro, contratos, orcamentos, projetos,
                       produtos, bookmarks, painel, pagar, settings
  lib/
    <domínio>/         regras e server actions por assunto (lista abaixo)
    db.ts, dates.ts, format.ts, list-query.ts, action-state.ts, actions.ts, utils.ts ...
  db/schema.ts         todas as tabelas
  proxy.ts             proxy do Next (antes chamado middleware)
drizzle/               migrações versionadas e journal
scripts/               suítes de integração e mocks de provedores (somente teste)
tests/                 testes unitários (node:test + tsx)
docs/                  esta documentação
assets/fonts/          fontes embutidas nos PDFs
public/brand/          logo, símbolo, fonte Sofia e avatares ilustrados
```

### `src/lib` por domínio

| Pasta | Conteúdo |
| --- | --- |
| `auth/` | Better Auth (`auth.ts`, `auth-client.ts`), plugin de segurança e duas etapas, política de OTP, envio de códigos, sessões |
| `access/` | `getActor`, `canAccess`, papéis, equipe do Console, membros das empresas, ambiente da conta, acesso assistido |
| `account/` | Minha conta: identidade, e-mails, foto e avatares, aparência |
| `companies/` | cadastro, consulta de CNPJ/CEP, endereço de cobrança, dados da empresa, exclusão, tabela |
| `billing/` | faturas, emissão no Inter, conciliação, recorrência, condições (desconto, multa, juros), link público, avisos de cobrança |
| `contracts/` | modelos, contratos, versões, assinatura, aditivos, vigência, PDF, e-mails |
| `quotes/` | orçamentos, versões, respostas do cliente, PDF, e-mails |
| `tickets/` | situações, anexos, avisos de chamados, exclusão, tabela |
| `projects/` | tarefas, quadro, comentários, exclusão de projetos e serviços |
| `catalog/` | catálogo de produtos e serviços |
| `bookmarks/` | pastas, compartilhamento, links e arquivos |
| `assistant/` | loop do assistente, ferramentas, consentimento, histórico, Jev, modelos do OpenRouter |
| `notifications/` | preferências por empresa, controle da operação, alertas e resumo diário da equipe |
| `integrations/` | estado das integrações em Configurações |

Na raiz de `lib/` fica só o que todos os domínios usam. `actions.ts` guarda server actions antigas de vários assuntos (empresas, chamados, faturas, vínculos) e deve ser dividido aos poucos (ver [task.md](task.md)).

## Rotas

- **Públicas:** `/entrar`, `/verificar-acesso` (segunda etapa), `/acesso-pendente`, `/pagar/[publicId]` e `/pagar/[publicId]/boleto`.
- **Autenticadas** (`(secure)`): `/painel`, `/empresas`, `/chamados`, `/projetos`, `/produtos`, `/financeiro` (e `/financeiro/envios`), `/contratos`, `/orcamentos`, `/bookmarks`, `/conta` e `/configuracoes/*`.
- **Criação em painel lateral:** `/chamados/novo`, `/empresas/nova`, `/financeiro/nova`, `/contratos/novo`, `/orcamentos/novo`, `/produtos/novo` e `/projetos/novo` existem como página (acesso direto) e como rota interceptada em `@ticket/(.)…` (navegação interna abre o painel sobre a tela atual). O `@ticket/[...rest]` não renderiza nada nas outras URLs e deixa endereços desconhecidos chegarem ao `not-found` do app.
- **Erros:** `app/not-found.tsx` (fora do app), `(secure)/not-found.tsx` (dentro do app, também usado quando o registro existe mas a pessoa não tem acesso), `error.tsx` nos dois níveis e `global-error.tsx` com HTML próprio.

## Dados

- Uma única `src/db/schema.ts`, com prefixo `console_` em todas as tabelas. Principais grupos:
  - **Identidade:** `user`, `session`, `account`, `verification` (Better Auth), `account_emails`, `two_factor`, `otp_limits`, `rate_limit`.
  - **Acesso:** `staff_members` (equipe Anuntech), `memberships` (pessoa × empresa × papel), `environment_profile` (cadastro da própria Anuntech).
  - **Clientes:** `companies`, `engagements` (produto, projeto ou serviço vinculado), `catalog_items`.
  - **Atendimento:** `tickets`, `messages`, `attachments`, `ticket_uploads`, `ticket_notices`.
  - **Projetos:** `tasks`, `task_assignees`, `task_comments` (anexos em `attachments.comment_id`).
  - **Financeiro:** `invoices`, `subscriptions` (recorrências), `billing_notices`, `email_deliveries`.
  - **Documentos:** `contract_templates`, `contracts`, `contract_versions`, `contract_signatures`, `quotes`, `quote_versions`.
  - **Outros:** `bookmarks`, `bookmark_folders`, `bookmark_folder_shares`, `notification_settings`, `notification_preferences`, `assistant_settings`, `assistant_documents`, `assistant_conversations`, `assistant_messages`, `audit_events`.
- Valores em centavos (`integer`). Vencimentos são datas civis (`date`, `YYYY-MM-DD`), sem conversão de fuso; "hoje" é calculado em America/Sao_Paulo (`lib/dates.ts`).
- Toda alteração relevante grava `audit_events` na mesma transação.
- Migrações: `npm run db:generate` (drizzle-kit, precisa de `DATABASE_URL`) gera o SQL; o CI e os testes aplicam o journal inteiro num banco descartável. Em produção a aplicação segue o procedimento de [rules.md](rules.md#migrações-em-produção).

## Acesso

- `getActor()` (`lib/access/access.ts`) lê a sessão, exige e-mail verificado e devolve quem é a pessoa: `admin` (equipe Anuntech), `owner` (dono do Console, definido por `CONSOLE_ADMIN_EMAIL`) e `grants` (empresas e papéis).
- Empresas têm dois papéis: `manager` (Administrador: tudo da empresa, inclusive financeiro, contratos e membros) e `member` (Membro: visão geral, chamados, projetos, produtos e bookmarks). `hasPermission(role, area)` traduz papel em área (`overview`, `support`, `finance`).
- `canAccess(actor, companyId, area)` e `allowedIds(actor, area)` filtram toda leitura; cada server action confere de novo antes de escrever.
- Cada conta pertence a um único ambiente: a operação Anuntech ou uma empresa cliente. Convites e verificação de e-mails recusam misturar ambientes.
- A equipe pode entrar "como a empresa" (acesso assistido) por um cookie que limita a sessão à visão daquele cliente.

## Server actions

- Arquivos `"use server"` em `lib/<domínio>/*-actions.ts`. Assinatura padrão `(prev: ActionState, form: FormData) => Promise<ActionState>` com `{ success?, error?, href? }`.
- A tela usa `ServerForm` (`components/console/server-form.tsx`), que mostra o toast de sucesso, mantém o erro no formulário e navega para `href`.
- O Next só encontra uma action a partir de uma página que a renderiza: formulários dentro de painéis e diálogos continuam funcionando porque a página importa o componente.
- Limite de corpo das actions: 2 MB (`next.config.ts`). Anexos maiores sobem em partes de 1 MB por `/api/chamados/uploads` (`components/console/staged-uploads.ts`).

## Integrações

| Serviço | Uso | Onde |
| --- | --- | --- |
| Banco Inter | Cobrança com boleto e Pix, consulta, PDF do boleto, cancelamento | `lib/billing/billing-publish.ts`, `billing-sync.ts`, `billing-actions.ts` |
| Resend | E-mails transacionais: códigos, cobranças, chamados, contratos, orçamentos, alertas | `lib/auth/otp-delivery.ts`, `lib/billing/billing-notices.ts` e os `*-mail.ts` |
| Synova (FLW/Helena) | WhatsApp: códigos de acesso, avisos de chamados e de cobrança; widget de suporte no site | `lib/auth/otp-delivery.ts`, `lib/tickets/ticket-notifications.ts`, `lib/billing/billing-notices.ts` |
| Focus NFe | Notas fiscais. Só a autenticação é verificada; emissão ainda não existe | `lib/integrations/integrations.ts` |
| OpenRouter | Modelo do assistente (padrão `anthropic/claude-sonnet-5`, trocável em Configurações) e Jev, que lê a intenção antes de ações | `lib/assistant/` |
| Vercel Blob | Fotos de perfil, store privada | `lib/account/profile-avatar.ts` |
| CNPJ.ws e ViaCEP | Preenchimento de cadastro por CNPJ e CEP | `lib/companies/company-lookup.ts`, `/api/cadastro/consulta` |
| Google | Entrada opcional | Better Auth |

O certificado do Inter chega em produção como variáveis BASE64; em desenvolvimento, por caminho local (`certificates/inter`, fora do Git).

## Rotinas

Crons da Vercel (`vercel.json`), todos protegidos por `CRON_SECRET`:

| Rota | Quando | O que faz |
| --- | --- | --- |
| `/api/cron/ticket-notifications` | a cada 5 min | Retoma a fila de avisos de chamados |
| `/api/cron/billing-sync` | a cada 5 min | Consulta cobranças emitidas no Inter e confirma pagamentos |
| `/api/cron/recurring-billing` | a cada 5 min | Emite as recorrências cuja data de emissão chegou, agenda os lembretes, envia os avisos de cobrança e confere as entregas |
| `/api/cron/contract-expiry` | diário, 11:00 UTC | Avisa contratos perto do fim e vencidos |
| `/api/cron/ops-digest` | diário, 11:30 UTC | Resumo da manhã para a equipe (emissões, pagamentos, falhas, atrasos, contratos) |

Avisos também são processados logo após a ação, com `after()`; o cron garante a retomada.

## Filas de aviso

- `ticket_notices` e `billing_notices` gravam payload e destino antes de chamar o provedor.
- E-mail: chave de idempotência do Resend fixa por rodada de envio (`invoice-<id>-<primeira tentativa>`). Um reenvio manual começa outra rodada.
- WhatsApp: resposta incerta não é repetida automaticamente; tentativas pendentes expiram em 23 horas.
- Trocar ou remover um contato cancela a tentativa pendente para o destino antigo.

## Assistente

- `POST /api/assistente` devolve NDJSON em streaming (`progress`, `done`, `error`). O painel (`components/assistant/assistant-panel.tsx`) mostra tempo e tokens enquanto trabalha e abre ao lado do conteúdo em telas largas.
- As ferramentas (`lib/assistant/assistant-tools*.ts`) usam o acesso da própria pessoa (`scopeOf`), podem ser só da equipe (`staffOnly`) ou só de clientes (`clientOnly`). As que alteram dados (`write`) passam pelo consentimento: um "sim" simples logo depois da pergunta aprova (`assistant-consent.ts`); qualquer outra resposta passa pelo Jev.
- O assistente também lê e preenche a tela atual (`page-snapshot.ts`, `components/assistant/page-bridge.ts`).
- Configurações → Assistente guarda modelo, instruções extras e documentos de conhecimento.

## Testes e CI

- `npm test`: testes unitários em `tests/` (regras puras: cobrança, datas, permissões, tabelas, consentimento).
- `npm run test:integration` (`scripts/test-isolated.mjs`): cria um banco `console_test_<aleatório>`, aplica todas as migrações, sobe `next start` e roda as suítes HTTP com provedores simulados: OTP, segurança, membros, conta, notificações, cobrança e regressão. Precisa de build prévio. `--members-only`, `--billing-only` etc. rodam uma suíte.
- Os mocks em `scripts/*-mock.cjs` substituem `fetch` no processo do servidor de teste. Nenhum código de aplicação os importa.
- As suítes postam formulários pelo nome da server action (lido do manifesto do build), então não quebram quando um texto de botão muda.
- GitHub Actions (`.github/workflows/checks.yml`) roda em todo push e PR: lint, testes unitários, build e integração completa num Postgres 17 temporário.

## Deploy

- Vercel com integração Git: push em `main` publica em produção. O trabalho do dia acontece na branch `codex/bookmarks-ticket-modal` e é levado para `main`.
- Variáveis de ambiente vivem na Vercel e, localmente, em `.env.local` (ignorado pelo Git). `.env.example` lista os nomes sem valores.
