/* eslint-disable @typescript-eslint/no-require-imports -- Node preload test harness uses CommonJS. */
// Test-process only. Never imported by the application or shipped to Vercel.
const https = require("node:https");
const fs = require("node:fs");
const { EventEmitter } = require("node:events");
const { randomUUID } = require("node:crypto");
const original = https.request;
const charges = new Map();
https.request = function (url, options, callback) {
  if (!String(url).includes("cdpj.partners.bancointer.com.br"))
    return original.apply(this, arguments);
  const req = new EventEmitter();
  req.destroy = () => req.emit("error", new Error("Mock interrupted"));
  req.end = (body) =>
    queueMicrotask(() => {
      const res = new EventEmitter();
      res.statusCode = 200;
      let result;
      const path = new URL(url).pathname;
      if (path === "/oauth/v2/token")
        result = { access_token: "test-token", expires_in: 3600 };
      else if (options.method === "POST" && path.endsWith("/cancelar")) {
        // Cancelling a charge; a reissue then posts a new one.
        const charge = charges.get(path.split("/")[4]);
        if (!charge) res.statusCode = 404;
        else charge.cancelled = true;
        result = {};
      } else if (options.method === "POST") {
        const payload = JSON.parse(body);
        const postFlags = JSON.parse(fs.readFileSync(process.env.CONSOLE_TEST_NOTICE_FLAGS, "utf8"));
        // The bank takes the charge but the answer never arrives ("Sem resposta do banco").
        if (postFlags.postTimeout && ![...charges.values()].some((c) => c.payload.seuNumero === payload.seuNumero)) {
          charges.set(randomUUID(), { payload, checks: 0 });
          req.emit("error", new Error("Mock timeout after the bank took the charge"));
          return;
        }
        if (
          [...charges.values()].some(
            (c) => c.payload.seuNumero === payload.seuNumero,
          )
        ) {
          res.statusCode = 409;
          result = {};
        } else {
          const id = randomUUID();
          charges.set(id, { payload, checks: 0 });
          result = { codigoSolicitacao: id };
        }
      } else if (path === "/cobranca/v3/cobrancas") {
        // The list the Console reads to find a charge by its reference.
        result = {
          cobrancas: [...charges.entries()].map(([id, c]) => ({ cobranca: { ...c.payload, codigoSolicitacao: id, situacao: c.cancelled ? "CANCELADO" : "A_RECEBER" } })),
        };
      } else {
        const id = path.split("/")[4],
          charge = charges.get(id);
        if (!charge) {
          res.statusCode = 404;
          result = {};
        } else if (path.endsWith("/pdf"))
          result = {
            pdf: Buffer.from("%PDF-1.7\nTest only").toString("base64"),
          };
        else {
          charge.checks++;
          const flags = JSON.parse(
            fs.readFileSync(process.env.CONSOLE_TEST_NOTICE_FLAGS, "utf8"),
          );
          if (flags.bankUnavailable) {
            req.emit("error", new Error("Mock bank unavailable"));
            return;
          }
          result = {
            cobranca: {
              ...charge.payload,
              codigoSolicitacao: id,
              dataVencimento:
                flags.billingBankDue || charge.payload.dataVencimento,
              situacao: charge.cancelled
                ? "CANCELADO"
                : flags.bankMarked
                  ? "MARCADO_RECEBIDO"
                  : flags.bankExpired
                  ? "EXPIRADO"
                  : flags.bankUnpaid
                  ? "A_RECEBER"
                  : charge.checks > 1
                    ? "RECEBIDO"
                    : "A_RECEBER",
            },
            boleto: { linhaDigitavel: "1".repeat(47) },
            pix: { pixCopiaECola: "test-pix-payload" },
          };
        }
      }
      callback(res);
      res.emit("data", Buffer.from(JSON.stringify(result)));
      res.emit("end");
    });
  return req;
};
