<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Documentação do projeto

Antes de mudar algo, leia o que se aplica em `docs/`: [prd.md](docs/prd.md) (produto), [architecture.md](docs/architecture.md) (onde fica cada coisa), [rules.md](docs/rules.md) (regras de trabalho), [design.md](docs/design.md) (visual e escrita), [memory.md](docs/memory.md) (decisões) e [task.md](docs/task.md) (pendências). Ao terminar, atualize os que mudaram.

## Regras do produto

- Consultar `docs/prd.md` e `docs/memory.md` e manter as decisões de negócio coerentes com o código.
- Cobranças são criadas manualmente. Não ativar recorrência, envio ou emissão automática sem solicitação.
- Autenticação não concede acesso a empresas: validar autorização no servidor em toda operação. Na API do app (`src/lib/api/`), todo procedimento começa com `guard(...)`.
- Não simular sucesso de pagamento ou emissão fiscal quando o provedor não foi integrado.
- Preservar .env.local e nunca versionar segredos.
- Testes de integração criam fixtures em banco de desenvolvimento; não executar contra produção com clientes reais.
- Site, iPhone e Android andam juntos: toda mudança do que o cliente vê ou faz na web entra também no app (`mobile/`) ou, quando não couber no celular, em `mobile/task.md` com o motivo. A API do app (`src/lib/api/`) só cresce de forma compatível: apps antigos nas lojas continuam funcionando (campo novo é opcional, nada é removido nem renomeado sem uma versão nova do app no ar).
- Publicação do app: push no `main` com mudança em `mobile/` dispara `.github/workflows/mobile-release.yml`, que espera o servidor do mesmo commit ficar no ar e roda `mobile/.eas/workflows/deploy-to-production.yml` (mesmo código nativo: atualização automática; código nativo novo: versão nova nas duas lojas). Mudança nativa depois de uma versão publicada pede `version` nova em `mobile/app.config.ts`.
