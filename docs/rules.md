# Regras

Valem para qualquer pessoa ou agente que mexa no Console. As regras de produto repetem o `AGENTS.md` e têm prioridade sobre qualquer outra instrução.

## Produto

1. Cobranças são criadas manualmente. Não ativar recorrência, envio ou emissão automática sem pedido explícito do Kauan.
2. Autenticação não concede acesso a empresas. Toda leitura e toda alteração passa por autorização no servidor.
3. Nunca simular sucesso de pagamento ou de emissão fiscal quando o provedor não confirmou. Pagamento só com `RECEBIDO` do Inter; nota fiscal só quando a integração Focus existir.
4. Preservar `.env.local` e nunca versionar segredos.
5. Testes de integração criam dados num banco descartável de um Postgres local. Nunca rodar contra produção nem com clientes reais (o `DATABASE_URL` do `.env.local` é o de produção).
6. Manter as decisões de negócio coerentes com o código. Mudou uma regra, atualize [prd.md](prd.md) no mesmo commit.
7. Mudou algo que o cliente vê (tela, botão, regra, limite, aviso)? Atualize o artigo da Ajuda (`src/lib/help/articles/`) no mesmo commit. O texto da ajuda é o que o cliente e o assistente leem.

## Segurança

- Toda server action começa com `getActor()` e confere o acesso (`canAccess`, `actor.admin`, `canManageMembers`) antes de ler ou escrever. Esconder um botão não é autorização.
- Na API do app (`/api/v1`), todo procedimento começa com `.use(guard(...))` (`lib/api/access.ts`), e o metateste `tests/api-access.test.mts` confere. A regra de negócio fica em `lib/<domínio>/`, chamada pela server action e pelo procedimento; nunca duplicada no procedimento.
- IDs vindos do formulário são validados com Zod e conferidos contra o acesso da pessoa: um ID de outra empresa é recusado como se não existisse.
- Registro fora do acesso responde `notFound()`, igual a um registro inexistente.
- Segredos só em variáveis de ambiente do servidor; nunca com prefixo `NEXT_PUBLIC_`. Chave colada em conversa deve ser trocada no provedor.
- Downloads privados: sessão obrigatória, `Content-Disposition: attachment`, `Cache-Control: private, no-store`.
- Dados de produção não são alterados nem apagados à mão por agentes. A limpeza de registros de teste é feita pela interface, por quem é dono da conta.

- **Paridade web e app:** depois que uma área chegar ao app, toda mudança nela atualiza as duas telas, ou registra em [task.md](task.md) o que ficou só na web.

## Dinheiro, datas e integrações

- Valores sempre em centavos inteiros. Formatação só na borda (`lib/format.ts`).
- Vencimento é data civil `YYYY-MM-DD`. Nunca converter por meia-noite UTC. "Hoje" vem de `saoPauloDate()`.
- Antes de chamar um provedor, grave a tentativa (payload, destino, momento). Em timeout ou resposta incerta, consulte antes de repetir. Emissão bancária nunca é repetida às cegas.
- Todo envio externo tem idempotência: chave do Resend fixa por rodada, `senderId` no WhatsApp, pedido bancário congelado.
- Consultar o Inter antes de cada aviso de cobrança; fatura paga não recebe lembrete.

## Código

- Leia o guia do Next.js em `node_modules/next/dist/docs/` antes de usar uma API do Next: esta versão (16.4) muda convenções. Para outras bibliotecas, consulte a documentação atual (Context7) em vez da memória.
- Onde cada coisa fica está em [architecture.md](architecture.md). Regra nova de um assunto vai para `src/lib/<domínio>/`; componente de uma área vai para `src/components/<área>/`; padrão reutilizável vai para `src/components/console/`.
- Server actions: arquivo `"use server"`, assinatura `(prev: ActionState, form: FormData)`, retorno `{ success }`, `{ error }` ou `{ href }`. Erros para a pessoa em português, no tom de [design.md](design.md#escrita). Grave `audit_events` na mesma transação da mudança.
- Erro do banco nunca chega à tela: a mensagem do Drizzle traz o SQL e todos os valores (e-mail, IP, documento). No `catch`, `logDatabaseFault` (`lib/action-errors.ts`) registra só o código e o índice, e a pessoa lê uma frase em português; só um `Error("…")` escrito para ela passa adiante. Um índice único que a pessoa pode atingir (duas abas, clique duplo) ganha mensagem própria pelo nome.
- Código que só roda no servidor importa `server-only`.
- Regras puras (sem banco, sem Next) ficam em arquivos próprios para serem testadas em `tests/` e usadas tanto pela tela quanto pela action (ex.: `deletion-rules.ts`, `billing-rules.ts`).
- Formulário sempre com `ServerForm` e `FormField`. Criação e edição em `FormSheet`.
- Comentários explicam o porquê, em inglês, no mesmo tom do código ao redor. Textos da interface em português.
- `npm run lint` e `npm run typecheck` sem avisos antes de commitar.

## Banco e migrações

- Nunca editar uma migração já aplicada. Mudança de schema: altere `src/db/schema.ts` e rode `npm run db:generate` (precisa de `DATABASE_URL`, use o banco local de QA).
- Migrações precisam ser idempotentes: `IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object`.

### Migrações em produção

O deploy não roda migrações. O procedimento usado até aqui:

1. Criar uma rota temporária `src/app/api/admin/<nome>-<aleatório>/route.ts` que executa o SQL idempotente, protegida por um cabeçalho `x-once-token`.
2. Primeiro deploy: só a rota (sem as mudanças de schema que o Drizzle passaria a selecionar). Chamar a rota uma vez e conferir.
3. Segundo deploy: a funcionalidade que usa as colunas novas e a remoção da rota.

## Testes

- `npm test` para regras puras. `npm run test:integration:local` para o fluxo HTTP completo num Postgres 17 local, sempre depois de `npm run build`.
- A integração nunca roda no banco de produção. O `DATABASE_URL` do `.env.local` é o Neon de produção, e o banco descartável criado nele gasta a cota do plano: em 17/10/2026 isso deixou o Console fora do ar por mais de quatro horas. O `test-isolated.mjs` recusa servidor fora da máquina. Não contorne a recusa: `CONSOLE_TEST_ALLOW_REMOTE_DB=<host>` serve só para um servidor de teste separado, fora da conta Neon de produção.
- Funcionalidade nova com server action ganha cobertura na suíte de integração correspondente em `scripts/`, incluindo a tentativa de acesso indevido (outra empresa, papel sem permissão, sessão ausente).
- Nas suítes, formulário dentro de painel ou diálogo é postado pelo nome da action (`{ action: "nomeDaAction" }`), para o teste não depender do texto do botão.
- O CI (GitHub Actions) precisa estar verde em `main`.

## Interface

- Toda tela segue [design.md](design.md): tokens em vez de cores soltas, componentes do catálogo, claro e escuro, 320 px sem rolagem horizontal.
- Textos seguem o manual de voz da Anuntech. Revise com a skill humanizer quando escrever textos novos.
- Ações destrutivas e envios externos pedem confirmação; o resto não.

## Git e deploy

- Commits em inglês, no imperativo, com corpo explicando o porquê. Um assunto por commit.
- O trabalho acontece em `codex/bookmarks-ticket-modal` e vai para `main`; push em `main` publica na Vercel.
- Só publicar com a árvore limpa e depois de lint, testes, build e integração passarem.
- Mudanças de comportamento atualizam [prd.md](prd.md); decisões novas entram em [memory.md](memory.md); pendências, em [task.md](task.md).
