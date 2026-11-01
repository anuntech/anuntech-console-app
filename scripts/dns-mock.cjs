/* eslint-disable @typescript-eslint/no-require-imports -- Node preload test harness uses CommonJS. */
// Test-process only. Never imported by the application or shipped to Vercel.
const fs = require("node:fs");

/*
 * DNS stand-in for E-mail's DNS health (lib/mail/mail-admin.ts): the test
 * server never asks the real DNS about anuntech.com. With
 * CONSOLE_TEST_DNS_FILE set, the MX and TXT lookups of node:dns/promises
 * (the module's functions and every Resolver) answer from that JSON file,
 * read at each call so a suite can change it between pages:
 *
 *   { "MX anuntech.com": [{ "exchange": "mx1.anuntech.cloud", "priority": 10 }],
 *     "TXT anuntech.com": [["v=spf1 mx -all"]],
 *     "TXT _dmarc.anuntech.com": "SERVFAIL" }
 *
 * A name missing from the file answers ENOTFOUND; a string answers as that
 * error code. Every question is appended to the file's ".log" twin.
 */
const file = process.env.CONSOLE_TEST_DNS_FILE;
if (file) {
  const dns = require("node:dns");
  const answers = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  };
  const lookup = (type) =>
    async function (name) {
      const key = `${type} ${String(name).toLowerCase().replace(/\.$/, "")}`;
      fs.appendFileSync(`${file}.log`, `${key}\n`);
      const answer = answers()[key];
      if (answer === undefined || typeof answer === "string") {
        const error = new Error(`${type.toLowerCase()} ${answer ?? "ENOTFOUND"} ${name}`);
        error.code = answer ?? "ENOTFOUND";
        error.hostname = name;
        throw error;
      }
      return JSON.parse(JSON.stringify(answer));
    };
  for (const target of [dns.promises, dns.promises.Resolver.prototype]) {
    target.resolveMx = lookup("MX");
    target.resolveTxt = lookup("TXT");
  }
}
