# Anuntech Console

Portal da Anuntech para clientes e equipe: empresas, chamados, projetos, cobrança com boleto e Pix, contratos, orçamentos e um assistente. Em produção em [console.anuntech.com](https://console.anuntech.com).

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [docs/prd.md](docs/prd.md) | O produto: pessoas, módulos, regras e o que está fora do escopo |
| [docs/architecture.md](docs/architecture.md) | Stack, pastas, dados, acesso, integrações, rotinas, testes e deploy |
| [docs/design.md](docs/design.md) | Tokens, componentes, padrões de tela, escrita e acessibilidade |
| [docs/rules.md](docs/rules.md) | Regras para quem mexe no código |
| [docs/memory.md](docs/memory.md) | Contexto, linha do tempo e decisões |
| [docs/task.md](docs/task.md) | Pendências |

## Rodar localmente

```sh
npm ci
cp .env.example .env.local   # só se ainda não existir; preencha os valores
npm run db:migrate
npm run dev                  # http://localhost:3100
```

O primeiro administrador é o e-mail em `CONSOLE_ADMIN_EMAIL`. Entrar não dá acesso a nenhuma empresa: a equipe adiciona cada pessoa.

## Verificar

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

A integração precisa de build prévio e de um PostgreSQL com permissão para criar bancos. Ela cria um banco descartável, aplica as migrações, testa por HTTP com provedores simulados e apaga o banco no fim. Nenhuma mensagem, cobrança ou nota real sai durante os testes.

## Segredos

`.env.local` é ignorado pelo Git. `.env.example` tem só os nomes das variáveis. Certificados do Inter ficam fora do repositório; na Vercel entram como BASE64.
