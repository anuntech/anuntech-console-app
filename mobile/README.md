# Anuntech Console (app nativo)

App Expo SDK 58 (React Native 0.88, Expo Router) do Console. Plano e decisões: `../docs/memory.md` e `../docs/architecture.md`.

## Rodar no simulador do iPhone

O app fala com um Console local na porta 3100. Esse Console precisa de um banco local: o `DATABASE_URL` do `.env.local` é o de produção.

1. Postgres local: `npm run test:integration:local -- --otp-only` na raiz cria o contêiner `console-smoke-pg17` (porta 5434).
2. Banco e dados de exemplo: crie um banco `console_mobile_dev` nesse Postgres e aplique o journal de `../drizzle` (como `scripts/test-isolated.mjs` faz).
3. Console: na raiz, `npm run build` e depois `next start --port 3100` com `DATABASE_URL` apontando para o banco local, `BETTER_AUTH_URL=http://localhost:3100` e o simulador de códigos (`NODE_OPTIONS=--require=$PWD/scripts/otp-mock.cjs` e `CONSOLE_TEST_OTP_FILE=/tmp/otp.jsonl`). Os códigos aparecem nesse arquivo.
4. App: `npm install` e `APP_ENV=development npx expo run:ios`.

`APP_ENV` escolhe o Console: `development` (localhost:3100), `preview` (`CONSOLE_URL`) ou `production` (console.anuntech.com). Fora de produção, o identificador ganha o sufixo do ambiente (`com.anuntech.console.development`), para conviver com o app da loja.

## Testes

- `npm run lint` e `npm run typecheck`.
- Maestro (`.maestro/`): com o app de desenvolvimento instalado no simulador e o Console local rodando, `OTP_FILE=/tmp/otp.jsonl EMAIL=<e-mail de teste> .maestro/run.sh` entra e sai; com `excluir` no fim, entra e exclui a conta. Os campos têm `testID` (`destination`, `code`, `confirmation`, `delete-account`).

## Lojas

`eas.json` tem os perfis `development` (simulador), `preview` (interno) e `production`. Antes do primeiro envio: `npx eas-cli@latest login`, `npx eas-cli@latest init` (gera o `EAS_PROJECT_ID`, que liga o push) e as credenciais da Apple e do Google.
