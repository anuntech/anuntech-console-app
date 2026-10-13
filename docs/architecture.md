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
    api/               route handlers (downloads, uploads, crons, assistente, transcricao, auth)
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
| `access/` | `getActor`, `canAccess`, papéis, equipe do Console, membros das empresas, ambiente da conta, acesso assistido, convite do Administrador no envio (`invite-manager.ts`), registro da entrega dos convites e lista dos parados (`invite-tracking.ts`), reenvio do convite (`resendInvite` em `members-actions.ts`) |
| `account/` | Minha conta: identidade, e-mails, foto e avatares, aparência |
| `companies/` | cadastro, consulta de CNPJ/CEP, endereço de cobrança, dados da empresa, exclusão, tabela; implantação (`onboarding.ts`), qualidade dos contatos (`contact-quality.ts`), lista de clientes da equipe (`clients-follow-up.ts`) e limpeza de registros de teste (`cleanup.ts`) |
| `billing/` | faturas, emissão no Inter, conciliação, recorrência (emissão no pagamento nas mensais), próximas cobranças (`upcoming-charges.ts`), cadastro pronto para cobrar (`billing-readiness.ts`), vigilância de dívidas e emissões (`billing-watch.ts`), origens de cobrança preparada (`charge-sources.ts`: dívida, entrada, saldo, contrato, excedente, cada uma uma vez; `prepared-release.ts` devolve a origem quando o rascunho sai), fila de atrasos (`collections.ts`), localização no Inter da emissão sem resposta (`billing-locate.ts`), cancelamento no Inter, condições (desconto, multa, juros), link público, avisos de cobrança |
| `contracts/` | modelos, contratos, versões, assinatura, aditivos (prorrogação e reajuste pelo IPCA em `readjust.ts`), vigência, rodadas de revisão (`contract-review-actions.ts`), campos do rascunho (`contract-fields.ts`, sugestões em `contract-suggestions.ts`), PDF, e-mails |
| `quotes/` | orçamentos, versões, respostas do cliente, PDF, e-mails; o que o orçamento aceito entrega aos próximos passos (`quote-handoff.ts`: campos do contrato por significado, entrada e saldo, quadro inicial) |
| `journeys/` | jornada do projeto (só a equipe): modelo-padrão de etapas e passos, briefing e regras de cada passo, puros e testados (`journey-model.ts`); o que o Console sabe de cada jornada (`journey-facts.ts`); ações (`journey-actions.ts`), listas de leitura (`journey-queries.ts`) e os rascunhos da IA (`journey-ai.ts`, servidos por `/api/jornadas/[id]/sugestao`) |
| `automations/` | os interruptores de Configurações → Automações (`automation-list.ts`, guardados em `environment_profile.automations`) e os avisos automáticos ao cliente (`client-automations.ts`: cada um reivindica um evento em `automation_events` antes de enviar) |
| `commercial/` | seguimento comercial e de projetos para o resumo e o painel (`follow-up.ts`, limites em `FOLLOW_UP`) |
| `tickets/` | situações, tipos e impacto (`ticket-intake.ts`), anexos, avisos de chamados, exclusão, tabela; vigilância da equipe (`ticket-watch.ts`: lembrete de primeira resposta, parados no cliente, estimativas, sem horas, responsável habitual), triagem do Jev (`ticket-triage.ts`), acompanhamento por clique (`ticket-follow-actions.ts`) e as listas de suporte do resumo (`support-follow-up.ts`) |
| `projects/` | tarefas, quadro, comentários, revisão de entregas (`reviewTask`), exclusão de projetos e serviços |
| `service-terms/` | calendário de dias úteis (`business-calendar.ts`), fichas dos modelos (`presets.ts`, com `presetForTemplate` pelo nome do modelo de contrato), condições (`terms.ts`, `terms-actions.ts`), relógio do chamado (`ticket-clock.ts`), textos para o cliente (`terms-text.ts`), banco de horas (`hours-bank.ts`, `hours-actions.ts`, envio do aviso e do relatório uma vez por mês e excedente pronto para cobrar em `hours-delivery.ts`), feriados da sede |
| `guide/` | conteúdo de Como trabalhamos (`guide-content.ts`, versionado), marcos por pessoa e primeiros passos |
| `catalog/` | catálogo de produtos e serviços |
| `bookmarks/` | pastas, compartilhamento, links, arquivos e lousas (`board-rules.ts`: a cena do Excalidraw, limites e o tipo de cada bookmark; `bookmarkFor` em `bookmarks.ts` decide quem vê e quem edita um bookmark, a mesma regra do download, da página da lousa e da gravação) |
| `assistant/` | loop do assistente, ferramentas, consentimento, histórico, Jev, modelos do OpenRouter, rascunho de resposta de chamado (`draft-reply.ts`), fases sugeridas de orçamento (`draft-phases.ts`) e a chamada única ao modelo com repetição e formato conferido (`one-shot.ts`) |
| `voice/` | ditado por microfone: regras comuns (`voice-rules.ts`: formatos, limites, onde o texto entra) e a transcrição no servidor (`voice-server.ts`) |
| `http/` | `same-origin.ts`, a checagem de origem dos route handlers que gravam ou custam dinheiro; `hourly-limit.ts`, limite por hora gravado no banco |
| `ops/` | saúde das rotinas (`cron-health.ts`: `trackedCron` grava a última execução de cada cron) e quem assina na auditoria um passo automático (`automation-actor.ts`) |
| `notifications/` | preferências por empresa, controle da operação, alertas e resumo diário da equipe, conferência da entrega dos alertas e dos convites (`ops-delivery.ts`, a cada 5 minutos), fechamento do mês (`month-close.ts`) |
| `integrations/` | estado das integrações em Configurações |
| `apps/` | apps dos clientes que só abrem dentro do Console: o registro dos quatro apps (`registry.ts`: id, hosts, origem, entrada, papel mínimo e tenant por empresa; puro e testado), o passe RS256 (`pass-token.ts`, puro; `pass.ts` lê a chave do ambiente), quem abre o quê (`app-access.ts`), a action que assina o passe (`app-actions.ts`, `openApp`) e os textos de recusa (`app-texts.ts`) |

Na raiz de `lib/` fica só o que todos os domínios usam. `actions.ts` guarda server actions antigas de vários assuntos (empresas, chamados, faturas, vínculos) e deve ser dividido aos poucos (ver [task.md](task.md)).

## Rotas

- **Públicas:** `/entrar`, `/verificar-acesso` (segunda etapa), `/acesso-pendente`, `/pagar/[publicId]`, `/pagar/[publicId]/boleto` e `/.well-known/jwks.json` (chave pública do passe dos apps).
- **Autenticadas** (`(secure)`): `/painel`, `/empresas`, `/chamados`, `/projetos`, `/produtos`, `/financeiro` (e `/financeiro/envios`), `/contratos`, `/orcamentos`, `/bookmarks` (e `/bookmarks/[id]/lousa`, a lousa em tela cheia), `/jornadas` (só a equipe), `/apps/[id]` (um app do cliente dentro do Console), `/conta` e `/configuracoes/*`.
- **Criação em painel lateral:** `/chamados/novo`, `/empresas/nova`, `/financeiro/nova`, `/contratos/novo`, `/orcamentos/novo`, `/produtos/novo`, `/projetos/novo` e `/jornadas/nova` existem como página (acesso direto) e como rota interceptada em `@ticket/(.)…` (navegação interna abre o painel sobre a tela atual). O `@ticket/[...rest]` não renderiza nada nas outras URLs e deixa endereços desconhecidos chegarem ao `not-found` do app.
- **Erros:** `app/not-found.tsx` (fora do app), `(secure)/not-found.tsx` (dentro do app, também usado quando o registro existe mas a pessoa não tem acesso), `error.tsx` nos dois níveis e `global-error.tsx` com HTML próprio.

## Dados

- Uma única `src/db/schema.ts`, com prefixo `console_` em todas as tabelas. Principais grupos:
  - **Identidade:** `user`, `session`, `account`, `verification` (Better Auth), `account_emails`, `two_factor`, `otp_limits`, `rate_limit`.
  - **Acesso:** `staff_members` (equipe Anuntech), `memberships` (pessoa × empresa × papel), `environment_profile` (cadastro da própria Anuntech).
  - **Clientes:** `companies`, `engagements` (produto, projeto ou serviço vinculado), `catalog_items`.
  - **Atendimento:** `tickets` (com tipo, impacto, canal, o que falta, relógio e o retrato das condições em `terms`), `messages`, `attachments`, `ticket_uploads`, `ticket_notices`.
  - **Condições e banco de horas:** `service_terms` (condições de atendimento por empresa ou por vínculo, com versão, publicação e conferência), `time_entries` (horas da equipe), `hours_months` (aprovação além do banco e relatório do mês), `user_milestones` (guia lido, primeiros passos).
  - **Projetos:** `tasks`, `task_assignees`, `task_comments` (anexos em `attachments.comment_id`).
  - **Financeiro:** `invoices`, `subscriptions` (recorrências), `billing_notices`, `email_deliveries`.
  - **Documentos:** `contract_templates`, `contracts`, `contract_versions`, `contract_signatures`, `contract_change_requests` (pedidos de alteração por cláusula e versão), `quotes`, `quote_versions`.
  - **Jornadas:** `journeys` (projeto, empresa ou contato, pedido, orçamento, projeto, hospedagem, responsável, situação e briefing) e `journey_steps` (o que a equipe marcou em cada passo: situação, link, valor, data, anotação, responsável e o texto da IA guardado), migração 0039.
  - **Automação:** `cron_runs` (última execução e erro de cada rotina), `automation_events` (o que uma automação ou decisão já fez, único por tipo e registro: dívida encerrada ou cobrada de novo, alerta enviado com o id do Resend (`ops-mail`), convite enviado e reenviado (`invite.mail`, `invite.resend`), rascunho de vencimento perdido (`subscription.catchup`), registro mantido na Limpeza (`cleanup.keep`), reajuste preparado por contrato e aniversário (`contract.readjust`), fechamento do mês e IPCA do dia). Colunas de ligação `contracts.quote_id`, `quotes.ticket_id`, `engagements.quote_id`, `invoices.quote_id` e os interruptores em `environment_profile.automations` (migração 0038).
  - **Outros:** `bookmarks` (um link em `url`, um arquivo em `file_name` + `content`, ou uma lousa: a cena do Excalidraw em `board` (jsonb) e o PNG do card em `preview`, migração 0040), `bookmark_folders`, `bookmark_folder_shares`, `notification_settings`, `notification_preferences`, `assistant_settings`, `assistant_documents`, `assistant_conversations`, `assistant_messages`, `audit_events`.
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
- Limite de corpo das actions: 2 MB (`next.config.ts`). O áudio do ditado vai por route handler (`/api/transcricao`, até 4 MB, abaixo dos 4,5 MB da Vercel), não por action: actions rodam uma por vez na página e não podem ser canceladas. Pelo mesmo motivo, as sugestões do modelo (`/api/chamados/[id]/sugestao`, `/api/orcamentos/[id]/fases` e `/api/jornadas/[id]/sugestao`, só a equipe, com limite por hora) também são route handlers.
- Anexos maiores sobem em partes de 1 MB por `/api/chamados/uploads` (`components/console/staged-uploads.ts`).
- A lousa salva sozinha por `PUT /api/bookmarks/[id]/lousa` (cena até 3 MB mais o PNG do card, origem conferida por `sameOrigin`, só quem pode editar o bookmark); o card lê o PNG em `GET /api/bookmarks/[id]/preview`. O editor (`components/bookmarks/board-canvas.tsx`) carrega o Excalidraw só no navegador (`next/dynamic`, sem SSR), espera 1,2 s depois do último traço e tenta de novo sozinho quando a gravação falha. A lousa veste a identidade do Console: `board-theme.css` mapeia as variáveis do Excalidraw para os tokens de `globals.css` (fonte Sofia, azul da marca, cards, bordas e raios, nos dois temas), o menu e a tela inicial são próprios (exportar imagem, limpar, fundo, voltar aos bookmarks; símbolo da Anuntech) e a biblioteca, a ajuda e os links para o site do Excalidraw ficam de fora. O mesmo arquivo anula, só dentro do quadro, as regras de elemento da camada `legacy` (`input` com 42px, links e títulos), com `:where()` e `revert`, para não passar por cima dos estilos do próprio Excalidraw. Um botão no canto superior direito do quadro (`renderTopRightUI`) põe o quadro em tela cheia pela Fullscreen API; some onde o navegador não a oferece (iPhone). As fontes do Excalidraw vêm do CDN dele (esm.sh) por padrão; `window.EXCALIDRAW_ASSET_PATH` apontaria para uma cópia em `public/` se isso virar problema.

## Apps dentro do Console

O CMS do Espaço Absolut, o CMS da MulheresFM, o Roteiro Digital e a Base Pendente rodam em domínios próprios, mas só funcionam dentro do Console. Substitui o acesso pelo Workspace (iframe + JWT do workspace.anuntech.com), que esses apps deixam de aceitar.

| App | `aud` | Origem | Entrada protegida | Papel mínimo |
| --- | --- | --- | --- | --- |
| CMS Espaço Absolut | `espaco-absolut-cms` | https://www.espacoabsolut.com (aceita também espacoabsolut.com) | `/admin` | Administrador |
| CMS MulheresFM | `mulheresfm-cms` | https://www.mulheresfm.com.br (aceita também mulheresfm.com.br e mulheresfmanuntech.vercel.app) | `/admin` | Administrador |
| Roteiro Digital | `brastemp-roteiro-digital` | https://brastemp-roteiro-digital.vercel.app | `/` | Membro |
| Base Pendente | `brastemp-base-pendente` | https://brastemp-base-pendente.vercel.app | `/` | Membro, com `tenant` por empresa |

- **Qual produto é um app:** `appForUrl` compara o `engagements.url` do produto com o registro: host da lista e caminho dentro da entrada (`https://www.espacoabsolut.com/admin/...` é o CMS; `https://www.espacoabsolut.com/` é o site e continua link externo). Não há coluna nova: o produto é um `engagement` do tipo `product` com `url`. Produtos e o painel do cliente levam esses produtos para `/apps/<id>`, na mesma aba.
- **Quem abre:** `resolveAppOpening` (`app-access.ts`) confere `getActor`, `canAccess(empresa, "overview")` (fora dela, 404), produto ativo, URL no registro, papel mínimo (`canOpenApp`: equipe sempre, Administrador tudo, Membro só os apps de Membro) e, na Base Pendente, o tenant da empresa (hoje só a Alvitek, `b0101b2f-…` → `dfbi2Hn3rypBVlFSpKdKAfMd5BjXYQoY`). A página mostra o motivo de cada recusa com `StatusPage`.
- **O passe nunca nasce no render.** A página só decide; `AppFrame` (`components/apps/app-frame.tsx`) chama a action `openApp` depois de montar, e a action confere tudo de novo, assina e devolve a `src` do iframe (`<origem><entrada>?console_pass=<passe>`). Assim o cache do roteador não reaproveita um passe vencido nem de outra pessoa. Recarregar pede outro passe. Cada passe grava `app.opened` em `audit_events` (detalhes: `app`, `engagement`).
- **O passe:** JWT RS256 com `kid`, `iss` fixo `https://console.anuntech.com`, `aud` = id do app, `sub` (usuário), `email`, `name`, `company` (empresa no Console), `role` (`staff`, `manager` ou `member`; a equipe vai como `staff`, inclusive no acesso assistido), `tenant` só na Base Pendente, `iat`, `nbf`, `exp` = `iat` + 120 e `jti`. Assinado com `node:crypto`, sem dependência. `signPass` recusa claims faltando em vez de mandar um passe que o app rejeitaria.
- **Chave:** `APP_PASS_PRIVATE_KEY` (RSA de 2048 bits ou mais, PKCS#8 em PEM, em base64) e `APP_PASS_KEY_ID`. Sem as duas, nada abre: a action responde com erro para a pessoa (o motivo vai para o log) e a JWKS responde 503. Trocar a chave invalida só os passes em voo (2 minutos); as sessões já abertas nos apps continuam até vencer.
- **JWKS:** `GET /.well-known/jwks.json`, pública, `Cache-Control: public, max-age=300`, só `kty`, `n`, `e`, `kid`, `alg` e `use`. O proxy só atua em `/conta` e `/configuracoes`, então ela não passa por login.
- **Iframe:** `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"` e `allow="clipboard-write"`. O `frame-ancestors 'none'` do Console impede que o Console seja emoldurado; não limita o que ele emoldura.
- **O lado de cada app** (nos repositórios de cada um): verifica o passe pela JWKS (só RS256, `iss`, `aud`, `exp`/`nbf` com 30 s de folga, `sub` e `company`), grava a própria sessão de 8 horas num cookie (`SameSite=None; Secure; Partitioned` em produção), responde 303 para a URL limpa e recusa navegação de topo (`Sec-Fetch-Dest: document`) com uma página "Abra pelo Console". Nas rotas protegidas usa `Content-Security-Policy: frame-ancestors https://console.anuntech.com`.
- **Teste local:** `CONSOLE_APP_ORIGINS` (`{"<aud>": "http://localhost:PORTA"}`) troca a origem de um app e aceita esse host nas URLs dos produtos. É ignorada quando `VERCEL_ENV=production`.

## Integrações

| Serviço | Uso | Onde |
| --- | --- | --- |
| Banco Inter | Cobrança com boleto e Pix, consulta, PDF do boleto, cancelamento | `lib/billing/billing-publish.ts`, `billing-sync.ts`, `billing-actions.ts` |
| Resend | E-mails transacionais: códigos, cobranças, chamados, contratos, orçamentos, alertas | `lib/auth/otp-delivery.ts`, `lib/billing/billing-notices.ts` e os `*-mail.ts` |
| Synova (FLW/Helena) | WhatsApp: códigos de acesso, avisos de chamados e de cobrança; widget de suporte no site | `lib/auth/otp-delivery.ts`, `lib/tickets/ticket-notifications.ts`, `lib/billing/billing-notices.ts` |
| Focus NFe | Notas fiscais. Só a autenticação é verificada; emissão ainda não existe | `lib/integrations/integrations.ts` |
| OpenRouter | Modelo do assistente (padrão `anthropic/claude-sonnet-5`, trocável em Configurações) e Jev, que lê a intenção antes de ações. Também transcreve o ditado (`/api/v1/audio/transcriptions`): Whisper Large V3 Turbo e, se falhar, Whisper Large V3, sempre com `provider.zdr` (`VOICE_MODEL` e `VOICE_FALLBACK_MODEL` trocam os modelos). O Jev não transcreve: só lê texto e responde com decisões | `lib/assistant/`, `lib/voice/` |
| Vercel Blob | Fotos de perfil, store privada | `lib/account/profile-avatar.ts` |
| CNPJ.ws e ViaCEP | Preenchimento de cadastro por CNPJ e CEP | `lib/companies/company-lookup.ts`, `/api/cadastro/consulta` |
| Banco Central (SGS) | IPCA dos últimos 12 meses (série 433), lido uma vez por dia pela rotina do resumo | `lib/contracts/readjust.ts` |
| Google | Entrada opcional | Better Auth |

O certificado do Inter chega em produção como variáveis BASE64; em desenvolvimento, por caminho local (`certificates/inter`, fora do Git).

## Rotinas

Crons da Vercel (`vercel.json`), todos protegidos por `CRON_SECRET` e envolvidos por `trackedCron`, que grava em `cron_runs` cada execução (o painel e o resumo avisam a rotina parada há mais de 30 minutos, ou 26 horas nas diárias):

| Rota | Quando | O que faz |
| --- | --- | --- |
| `/api/cron/ticket-notifications` | a cada 5 min | Retoma a fila de avisos de chamados, manda à equipe o lembrete da primeira resposta (antes e no estouro) e os avisos ao cliente que saem na hora (80% do banco, contrato assinado) |
| `/api/cron/billing-sync` | a cada 5 min | Consulta até 40 cobranças emitidas no Inter e confirma pagamentos; procura no Inter, pela referência, as emissões sem resposta |
| `/api/cron/recurring-billing` | a cada 5 min | Emite as recorrências cuja data de emissão chegou e, nas mensais, o período seguinte de uma fatura recém-paga (`earlyIssueAllowed` em `billing/recurrence.ts`); agenda os lembretes, envia os avisos de cobrança e confere as entregas, inclusive dos alertas da equipe |
| `/api/cron/contract-expiry` | diário, 11:00 UTC | Avisa contratos perto do fim e vencidos |
| `/api/cron/client-notices` | diário, 12:00 UTC | Avisos automáticos ao cliente ligados em Automações: relatório do banco de horas, lembretes de orçamento, contrato e chamado, entregas para revisar e o resumo semanal (segundas) |
| `/api/cron/ops-digest` | diário, 11:30 UTC | Resumo da manhã para a equipe (emissões, pagamentos, falhas, emissões que vão falhar, dívidas expiradas, atrasos, contratos, rotinas, certificado e os seguimentos), o IPCA do dia e, no 1º dia útil, o fechamento do mês |

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

## Ditado

- `components/console/use-dictation.ts` é o único lugar que abre o microfone: grava com `MediaRecorder` (webm/opus; mp4 no Safari antigo), para em 2 minutos, ao esconder a página ou ao perder o microfone, e solta o microfone em toda saída (parar, cancelar, erro, desmontar).
- `POST /api/transcricao` recebe o áudio cru: origem, sessão, permissão de suporte, formato, tamanho e 30 por hora por pessoa (linha HMAC `voice:` em `console_otp_limits`). Devolve só `{ text }`; nada do áudio é gravado nem vai para o log.
- O texto entra onde estava o cursor (`joinTranscript`). No chamado, `DictationButton` mantém o campo não controlado (o reset do formulário continua valendo); no assistente, `MetalPromptBar` com `dictation`. Enviar o formulário encerra uma gravação em curso.
- Escape cancela a gravação antes de fechar o painel ou a folha (`data-escape-local`). O assistente não aperta o botão Falar (`data-assistant-ignore` em `clickPage`).
- `Permissions-Policy: microphone=(self)` em `next.config.ts`: só o próprio Console usa o microfone. `VOICE_INPUT=off` desliga o recurso e esconde o botão.

## Testes e CI

- `npm test`: testes unitários em `tests/` (regras puras: cobrança, datas, permissões, tabelas, consentimento, registro e passe dos apps).
- `npm run test:integration` (`scripts/test-isolated.mjs`): cria um banco `console_test_<aleatório>`, aplica todas as migrações, sobe `next start` e roda as suítes HTTP com provedores simulados: OTP, segurança, membros, conta, notificações, cobrança e regressão. Precisa de build prévio. `--members-only`, `--billing-only` etc. rodam uma suíte. A regressão gera uma chave de passe só para a rodada e termina com `scripts/apps-smoke.mjs`: JWKS, quem abre cada app, o passe verificado como um app verifica, a auditoria e os links. `CONSOLE_TEST_HTTP_PORT` troca a porta da regressão (padrão 3101).
- Os mocks em `scripts/*-mock.cjs` substituem `fetch` no processo do servidor de teste. Nenhum código de aplicação os importa. A regressão carrega também `openrouter-mock.cjs`, que responde a transcrição pelos primeiros bytes do áudio (sucesso, falha do primeiro modelo, silêncio) e registra só modelo, formato e tamanho.
- As suítes postam formulários pelo nome da server action (lido do manifesto do build), então não quebram quando um texto de botão muda.
- GitHub Actions (`.github/workflows/checks.yml`) roda em todo push e PR: lint, testes unitários, build e integração completa num Postgres 17 temporário.

## Deploy

- Vercel com integração Git: push em `main` publica em produção. O trabalho do dia acontece na branch `codex/bookmarks-ticket-modal` e é levado para `main`.
- Variáveis de ambiente vivem na Vercel e, localmente, em `.env.local` (ignorado pelo Git). `.env.example` lista os nomes sem valores.
