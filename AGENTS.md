<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Regras do produto

- Consultar a wiki Console e manter as decisões de negócio coerentes com o código.
- Cobranças são criadas manualmente. Não ativar recorrência, envio ou emissão automática sem solicitação.
- Autenticação não concede acesso a empresas: validar autorização no servidor em toda operação.
- Não simular sucesso de pagamento ou emissão fiscal quando o provedor não foi integrado.
- Preservar .env.local e nunca versionar segredos.
- Testes de integração criam fixtures em banco de desenvolvimento; não executar contra produção com clientes reais.
