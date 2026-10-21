#!/bin/sh
# Roda os fluxos no simulador contra um Console local com o simulador de
# códigos (scripts/otp-mock.cjs). OTP_FILE é o CONSOLE_TEST_OTP_FILE do servidor.
#   OTP_FILE=/tmp/otp.jsonl EMAIL=ana@example.invalid ./run.sh [excluir]
# Entre os dois pedidos de código para o mesmo e-mail vale o limite de 60 s.
set -e
cd "$(dirname "$0")"
: "${OTP_FILE:?OTP_FILE}" "${EMAIL:?EMAIL}"
code() { tail -1 "$OTP_FILE" | sed -E 's/.*"code":"([0-9]{6})".*/\1/'; }
maestro test -e EMAIL="$EMAIL" entrar-1-pedir.yaml
maestro test -e CODE="$(code)" entrar-2-codigo.yaml
if [ "$1" = "excluir" ]; then
  sleep 61
  maestro test excluir-1-pedir.yaml
  maestro test -e CODE="$(code)" excluir-2-confirmar.yaml
else
  maestro test sair.yaml
fi
