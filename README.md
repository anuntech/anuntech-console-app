# Anuntech Console

Portal de clientes da Anuntech para produtos, projetos, atendimento e financeiro.

## Implementado

- Google OAuth com Better Auth e sessões no PostgreSQL/Neon.
- Administração interna por e-mail explicitamente autorizado.
- Empresas e liberação/revogação de acesso por e-mail verificado.
- Permissões separadas de atendimento e financeiro por empresa.
- Produtos e projetos com situação e descrição.
- Chamados com respostas, responsável, status e anexos privados.
- Faturas manuais: rascunhos, emissão Inter de boleto com Pix, consulta manual de pagamento e download privado do boleto.
- Tentativa bancária persistida antes do envio; edição/cancelamento do rascunho bloqueados após tentativa. Resposta incerta exige reconciliação, sem repetir a emissão.
- Diagnóstico de autenticação Inter, Focus NFe e canais FLW em Configurações (admin).
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

O teste de integração requer build prévio e banco de desenvolvimento. Inicia servidor em `127.0.0.1:3101`, cria fixtures isoladas, verifica autorização e formulários por HTTP e remove os próprios registros ao terminar. Não envia e-mail nem transaciona com bancos: o servidor de teste carrega scripts/inter-mock.cjs para simular o Inter. Não rodar no banco de produção com clientes reais. O teste de OAuth verifica o redirecionamento, não substitui a validação de login real pelo Google.

## Estrutura

- `src/app`: páginas e rotas HTTP.
- `src/components`: interface e formulários.
- `src/lib`: autenticação, permissões e operações de negócio.
- `src/db/schema.ts`: estrutura do banco.
- `drizzle`: migrações versionadas; não alterar migrações já aplicadas.
- `tests` e `scripts/smoke.mjs`: verificações automatizadas.

## Limites atuais

Autenticação Inter validada com certificado real. Emissão e consulta de cobranças têm testes HTTP com banco simulado; nenhuma cobrança real foi emitida na validação. A cobrança Inter exige pagador/endereço, pelo menos R$ 2,50 e vencimento a partir do próximo dia. O QR Pix depende de chave cadastrada na conta Inter. A atualização de pagamento ocorre pela ação manual de consulta; webhook bancário ainda não está habilitado.

Focus NFe: tokens testados por consulta nos dois ambientes; emissão bloqueada enquanto aguardamos dados fiscais. FLW: token e canal ativo conferidos; disparos e recuperação de acesso aguardam fluxo e modelos adequados. Nenhuma emissão fiscal é simulada. Não há recorrência ou disparos automáticos. Notificações de entrega/bounce de e-mail ainda não têm webhook: acompanhar no Resend. O aviso de acesso é enviado uma única vez por vínculo; repetição segura dentro de 23 horas reutiliza a tentativa. Links de acesso em avisos exigem HTTPS.

Anexos de PDF/PNG/JPEG ficam no banco, com download privado: até 1 MB cada e 20 por chamado. A leitura exige a mesma permissão de atendimento do chamado. Para volume maior, migrar o conteúdo para armazenamento privado dedicado.

Listagens de chamados e faturas exibem até 200 itens recentes. Ainda não há filtros/paginação avançada, edição de cobrança emitida, estorno, baixa manual ou cancelamento bancário.

Antes de receber clientes reais, separar desenvolvimento/produção no Neon e concluir testes do OAuth Google e dos provedores financeiros em homologação.

## Documentação e segredos

Decisões do produto: `/Users/kauan/Desktop/anuntech/anuntech-wiki/Console/`.

`.env.local` é ignorado pelo Git. `.env.example` contém somente nomes e valores públicos de configuração. Segredos nunca usam `NEXT_PUBLIC_`. GitHub/Vercel/Cloudflare são configurados como infraestrutura, não como credenciais do runtime.

Referências: [Next.js](https://nextjs.org/docs), [Better Auth](https://better-auth.com/docs), [Neon](https://neon.com/docs), [Resend](https://resend.com/docs).

## Integrações — referências oficiais

- [Inter Cobrança](https://developers.inter.co/references/cobranca-bolepix): emissão, consulta, PDF e idempotência bancária de 30 minutos.
- [Focus autenticação](https://doc.focusnfe.com.br/reference/autenticacao): Basic com token por ambiente; consultar referência inexistente verifica autenticação sem emitir nota.
- [FLW/Helena](https://helena.readme.io/reference/getting-started-with-your-api): Bearer; canais e templates usam /chat/v1, separado do /core/v1.

Certificados em certificates/inter são privados e excluídos do Git e dos uploads Vercel. Na Vercel utilizam-se apenas as variáveis BASE64; caminhos locais não são enviados.
