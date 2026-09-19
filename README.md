# Anuntech Console

Portal de clientes da Anuntech para produtos, projetos, atendimento e financeiro.

## Implementado

- Google OAuth com Better Auth e sessões no PostgreSQL/Neon.
- Administração interna por e-mail explicitamente autorizado.
- Empresas e liberação/revogação de acesso por e-mail verificado.
- Permissões separadas de atendimento e financeiro por empresa.
- Produtos e projetos com situação e descrição.
- Chamados com respostas, responsável, status e anexos privados.
- Faturas manuais em rascunho e cancelamento de rascunhos.
- Aviso de acesso manual via Resend, com idempotência e registro da tentativa.
- Histórico de operações no banco.

## Executar

```sh
npm ci
cp .env.example .env.local # apenas se o arquivo local ainda não existir
# Preencher banco, Google, secret, URL e CONSOLE_ADMIN_EMAIL localmente.
npm run db:migrate
npm run dev
```

Desenvolvimento em http://localhost:3100. A aplicação inicia pelo login em `/entrar`.

O primeiro administrador é definido em `CONSOLE_ADMIN_EMAIL`. Não existe cadastro público que conceda acesso a empresas. Um cliente entra com o e-mail autorizado pela administração. Autenticação por Google não substitui autorização.

## Verificação

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

O teste de integração requer build prévio e banco de desenvolvimento. Inicia servidor em `127.0.0.1:3101`, cria fixtures isoladas, verifica autorização e formulários por HTTP e remove os próprios registros ao terminar. Não envia e-mail nem transaciona com bancos. Não rodar no banco de produção com clientes reais. O teste de OAuth verifica o redirecionamento, não substitui a validação de login real pelo Google.

## Estrutura

- `src/app`: páginas e rotas HTTP.
- `src/components`: interface e formulários.
- `src/lib`: autenticação, permissões e operações de negócio.
- `src/db/schema.ts`: estrutura do banco.
- `drizzle`: migrações versionadas; não alterar migrações já aplicadas.
- `tests` e `scripts/smoke.mjs`: verificações automatizadas.

## Limites atuais

Inter, Focus NFe e FLW aguardam credenciais e validação. Nenhuma emissão financeira/fiscal é simulada. Não há recorrência ou disparos automáticos. Notificações de entrega/bounce de e-mail ainda não têm webhook: acompanhar no Resend. O aviso de acesso é enviado uma única vez por vínculo; repetição segura dentro de 23 horas reutiliza a tentativa. Links de acesso em avisos exigem HTTPS.

Anexos de PDF/PNG/JPEG ficam no banco, com download privado: até 1 MB cada e 20 por chamado. A leitura exige a mesma permissão de atendimento do chamado. Para volume maior, migrar o conteúdo para armazenamento privado dedicado.

Listagens de chamados e faturas exibem até 200 itens recentes. Ainda não há filtros/paginação avançada, edição de cobrança emitida, estorno, baixa manual ou cancelamento bancário.

Antes de receber clientes reais, separar desenvolvimento/produção no Neon e concluir testes do OAuth Google e dos provedores financeiros em homologação.

## Documentação e segredos

Decisões do produto: `/Users/kauan/Desktop/anuntech/anuntech-wiki/Console/`.

`.env.local` é ignorado pelo Git. `.env.example` contém somente nomes e valores públicos de configuração. Segredos nunca usam `NEXT_PUBLIC_`. GitHub/Vercel/Cloudflare são configurados como infraestrutura, não como credenciais do runtime.

Referências: [Next.js](https://nextjs.org/docs), [Better Auth](https://better-auth.com/docs), [Neon](https://neon.com/docs), [Resend](https://resend.com/docs).
