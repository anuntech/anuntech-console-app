# Anuntech Console (app nativo)

App Expo SDK 58 (React Native 0.88, Expo Router) do Console. Plano e decisões: `../docs/memory.md` e `../docs/architecture.md`.

## Rodar no simulador do iPhone

Na raiz do repositório: `npm run mobile:dev` (`scripts/mobile-dev.mjs`). Ele liga o Postgres local do Docker (contêiner `console-smoke-pg17`, porta 5434), cria o banco `console_mobile_dev` com dados fictícios, sobe o Console em `localhost:3100` apontando para esse banco e abre o app no simulador. Nada usa o `.env.local` de produção: os códigos de entrada aparecem no terminal, e o `otp-mock.cjs` recusa qualquer chamada para fora do Mac.

- Contas: `ana@demo.invalid` (Administradora, WhatsApp (11) 90000-0001) e `bruno@demo.invalid` (Membro) na "Empresa Demonstração"; `equipe@demo.invalid` é a equipe.
- No iPhone pelo cabo: `DEVICE="<nome do iPhone>" npm run mobile:dev`. O iPhone precisa do Modo de Desenvolvedor ligado e da mesma rede Wi-Fi do Mac (o app fala com o Console pelo nome `.local` do Mac). O build de desenvolvimento é assinado no Xcode com o time da Anuntech e não tem push nem links do app, que dependem do App ID criado pelo EAS.
- Com o app já instalado: `npm run mobile:dev -- --serve` sobe só o Console e o Metro, sem build nem cabo.
- `-- --reset` recria os dados fictícios; `-- --build` refaz o build do Console depois de mudar o código do servidor; `SIMULATOR="iPhone 17"` troca o aparelho.

`APP_ENV` escolhe o Console: `development` (localhost:3100), `preview` (`CONSOLE_URL`) ou `production` (console.anuntech.com). Fora de produção, o identificador ganha o sufixo do ambiente (`com.anuntech.console.development`), para conviver com o app da loja.

## No iPhone com o Console de produção (sem EAS)

`APP_ENV=preview CONSOLE_URL=https://console.anuntech.com npx expo prebuild -p ios --clean` e depois `APP_ENV=preview CONSOLE_URL=https://console.anuntech.com npx expo run:ios --configuration Release --device "<nome do iPhone>" --no-bundler`. Instala "Console (preview)" (`com.anuntech.console.preview`) com o código embutido: funciona longe do Mac, com a conta de verdade. Assinado no Xcode com o time da Anuntech, sem push nem links do app. Para voltar ao desenvolvimento, rode o `prebuild` de novo com `APP_ENV=development`.

## Testes

- `npm run lint` e `npm run typecheck`.
- Maestro (`.maestro/`): com o app de desenvolvimento instalado no simulador e o Console local rodando, `OTP_FILE=/tmp/otp.jsonl EMAIL=<e-mail de teste> .maestro/run.sh` entra e sai; com `excluir` no fim, entra e exclui a conta. Os campos têm `testID` (`destination`, `code`, `confirmation`, `delete-account`).

## Lojas

`eas.json` tem os perfis `development` (simulador), `preview` (interno) e `production`. Antes do primeiro envio: `npx eas-cli@latest login`, `npx eas-cli@latest init` (gera o `EAS_PROJECT_ID`, que liga o push) e as credenciais da Apple e do Google.
