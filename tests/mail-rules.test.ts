import assert from "node:assert/strict";
import test from "node:test";
import {
  GIB,
  MAIL_DOMAINS,
  canManageMail,
  compareDns,
  dnsQuestions,
  expectedDns,
  generatePassword,
  isMailDomain,
  localPartProblem,
  mobileconfig,
  mobileconfigFileName,
  normalizeAddress,
  normalizeLocalPart,
  parseQuota,
  parseRecipients,
  parseZoneFile,
  passwordProblem,
  quotaChoice,
  quotaUse,
  storageLabel,
  type DnsLookups,
} from "../src/lib/mail/mail-rules";

test("phase 1: only the team, only anuntech.com", () => {
  assert.deepEqual([...MAIL_DOMAINS], ["anuntech.com"]);
  assert.equal(canManageMail({ admin: true }), true);
  assert.equal(canManageMail({ admin: true }, "anuntech.com"), true);
  assert.equal(canManageMail({ admin: true }, "teste.anuntech.cloud"), false);
  assert.equal(canManageMail({ admin: false }, "anuntech.com"), false);
  assert.equal(canManageMail({ admin: false }), false);
  assert.equal(isMailDomain("ANUNTECH.com"), true);
  assert.equal(isMailDomain("anuntech.com.br"), false);
  assert.equal(isMailDomain(undefined), false);
});

test("local parts: lower case, the domain typed in full is dropped, the server's own are refused", () => {
  assert.equal(normalizeLocalPart("  Joao.Silva "), "joao.silva");
  assert.equal(normalizeLocalPart("joao@ANUNTECH.com"), "joao");
  assert.equal(normalizeLocalPart("joao@gmail.com"), "joao@gmail.com");
  for (const ok of ["kauan", "no-reply", "jennifer.cardoso", "a", "tax_2026", "x1"]) assert.equal(localPartProblem(ok), null, ok);
  for (const bad of ["", ".kauan", "kauan.", "ka..uan", "ka uan", "joão", "a@b", "-x", "x-", "a.-b", "x".repeat(65)])
    assert.ok(localPartProblem(bad), bad);
  assert.match(localPartProblem("postmaster")!, /servidor/);
  assert.match(localPartProblem("joao@gmail.com")!, /antes do @/);
});

test("forward destinations: addresses only, without repeats", () => {
  assert.equal(normalizeAddress(" Fulano@Gmail.com "), "fulano@gmail.com");
  assert.equal(normalizeAddress("sem-arroba"), null);
  assert.equal(normalizeAddress("a@b"), null);
  assert.equal(normalizeAddress("a..b@x.com"), null);
  assert.deepEqual(parseRecipients("a@x.com, B@x.com\na@x.com; nada"), { valid: ["a@x.com", "b@x.com"], invalid: ["nada"] });
  assert.deepEqual(parseRecipients("   "), { valid: [], invalid: [] });
});

test("quotas: 1, 5, 10 or 20 GB in the server's binary bytes", () => {
  assert.equal(parseQuota("5"), 5 * 1024 ** 3);
  assert.equal(parseQuota("5"), 5368709120);
  for (const bad of ["3", "", "5.0", "05", "1e1", "-1", "20000", "abc", undefined, null]) assert.equal(parseQuota(bad), null, String(bad));
  assert.equal(quotaChoice(10 * GIB), 10);
  assert.equal(quotaChoice(3 * GIB), null);
  assert.equal(quotaChoice(null), null);
  assert.equal(storageLabel(0), "0 MB");
  assert.equal(storageLabel(1), "1 MB");
  assert.equal(storageLabel(320 * 1024 ** 2), "320 MB");
  assert.equal(storageLabel(1.4 * GIB), "1,4 GB");
  assert.equal(storageLabel(5 * GIB), "5 GB");
  assert.deepEqual(quotaUse(GIB, 5 * GIB), { percent: 20, tone: "normal" });
  assert.deepEqual(quotaUse(4.2 * GIB, 5 * GIB), { percent: 84, tone: "warning" });
  assert.deepEqual(quotaUse(6 * GIB, 5 * GIB), { percent: 100, tone: "full" });
  assert.deepEqual(quotaUse(GIB, null), { percent: null, tone: "normal" });
});

test("typed passwords: 12 to 128, not repetitive, not the address, mixed when short", () => {
  assert.equal(passwordProblem("Cavalo-Bateria-27"), null);
  assert.equal(passwordProblem("uma frase longa de verdade"), null);
  assert.match(passwordProblem("Curta-1")!, /12/);
  assert.match(passwordProblem("x".repeat(129))!, /128/);
  assert.match(passwordProblem(" Cavalo-Bateria-27")!, /espaços/);
  assert.match(passwordProblem("abababababababab")!, /repete/);
  assert.match(passwordProblem("kauan-Anuntech-2026", { local: "kauan" })!, /endereço/);
  assert.match(passwordProblem("abcdefghijkl")!, /misture/);
  assert.match(passwordProblem("Senha\u0000Forte-123")!, /caractere/);
});

test("generated passwords: four groups of six from a clear alphabet, all three kinds, strong by our own rule", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const password = generatePassword();
    assert.match(password, /^[A-HJ-NP-Za-km-z2-9]{6}(-[A-HJ-NP-Za-km-z2-9]{6}){3}$/);
    assert.ok(/[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password), password);
    assert.ok(password.length >= 20);
    assert.equal(passwordProblem(password), null, password);
    seen.add(password);
  }
  assert.equal(seen.size, 200);
  // A source that never gives a digit at first is retried until one shows up.
  let calls = 0;
  const lettersFirst = (max: number) => (calls++ < 24 ? 0 : (calls * 7) % max);
  assert.match(generatePassword(lettersFirst), /[0-9]/);
});

test("the Apple profile: IMAP 993 and SMTP 465 over SSL, the address as user, never a password", () => {
  const uuids: [string, string] = ["0f8e1c1a-1111-4222-8333-944455556666", "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d"];
  const profile = mobileconfig({ address: "kauan@anuntech.com", name: 'Kauan "K" <Ketner> & cia', uuids });
  assert.match(profile, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(profile, /<string>com\.apple\.mail\.managed<\/string>/);
  assert.match(profile, /<key>PayloadType<\/key>\n\t<string>Configuration<\/string>/);
  assert.match(profile, /<key>IncomingMailServerHostName<\/key>\n\t\t\t<string>mail\.anuntech\.com<\/string>/);
  assert.match(profile, /<key>IncomingMailServerPortNumber<\/key>\n\t\t\t<integer>993<\/integer>/);
  assert.match(profile, /<key>OutgoingMailServerPortNumber<\/key>\n\t\t\t<integer>465<\/integer>/);
  assert.match(profile, /<key>IncomingMailServerUseSSL<\/key>\n\t\t\t<true\/>/);
  assert.match(profile, /<key>OutgoingMailServerUseSSL<\/key>\n\t\t\t<true\/>/);
  assert.match(profile, /<key>IncomingMailServerUsername<\/key>\n\t\t\t<string>kauan@anuntech\.com<\/string>/);
  assert.match(profile, /<key>OutgoingPasswordSameAsIncomingPassword<\/key>\n\t\t\t<true\/>/);
  assert.match(profile, /Kauan &quot;K&quot; &lt;Ketner&gt; &amp; cia/);
  assert.match(profile, /0F8E1C1A-1111-4222-8333-944455556666/);
  assert.doesNotMatch(profile, /Password<\/key>\s*<string>/);
  assert.doesNotMatch(profile, /<key>(IncomingPassword|OutgoingPassword)<\/key>/);
  // Every key has a value: an odd count would make the iPhone refuse the file.
  assert.equal((profile.match(/<key>/g) ?? []).length, (profile.match(/<\/(string|integer)>|<(true|false)\/>|<\/array>/g) ?? []).length);
  assert.equal(mobileconfigFileName("Kauan@Anuntech.com"), "email-kauan-anuntech-com.mobileconfig");
  assert.throws(() => mobileconfig({ address: "nao-e-email", uuids }));
  assert.throws(() => mobileconfig({ address: "a@anuntech.com", uuids: ["x", "y"] }));
});

const ZONE = `$ORIGIN anuntech.com.
; Zone generated by the mail server
@                 3600 IN MX 10 mx1.anuntech.cloud.
anuntech.com.     IN TXT "v=spf1 mx -all"
mx1               IN TXT "v=spf1 a -all"
v1-rsa-20261026._domainkey IN TXT ( "v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx"
                                   "yz123" )
v1-ed25519-20261026._domainkey.anuntech.com. IN TXT "v=DKIM1; k=ed25519; h=sha256; p=11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo="
_dmarc            IN TXT "v=DMARC1; p=reject; rua=mailto:postmaster@anuntech.com"
_imaps._tcp       IN SRV 0 1 993 mail.anuntech.com.
autoconfig        IN CNAME mail.anuntech.com.
`;

test("the server's zone file: names, TXT split in strings, parentheses, comments", () => {
  const records = parseZoneFile(ZONE, "anuntech.com");
  assert.deepEqual(records[0], { name: "anuntech.com", type: "MX", value: "10 mx1.anuntech.cloud." });
  assert.ok(records.some((r) => r.name === "mx1.anuntech.com" && r.value === "v=spf1 a -all"));
  const rsa = records.find((r) => r.name === "v1-rsa-20261026._domainkey.anuntech.com");
  assert.equal(rsa?.value, "v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxyz123");
  assert.ok(records.some((r) => r.type === "SRV" && r.name === "_imaps._tcp.anuntech.com"));
  const expected = expectedDns(records, "anuntech.com");
  assert.deepEqual(expected.mx, ["mx1.anuntech.cloud"]);
  assert.equal(expected.spf, "v=spf1 mx -all");
  assert.deepEqual(
    expected.dkim.map((k) => k.selector),
    ["v1-rsa-20261026", "v1-ed25519-20261026"],
  );
  assert.equal(expected.dmarc, "v=DMARC1; p=reject; rua=mailto:postmaster@anuntech.com");
  assert.deepEqual(dnsQuestions(expected), [
    "anuntech.com",
    "v1-rsa-20261026._domainkey.anuntech.com",
    "v1-ed25519-20261026._domainkey.anuntech.com",
    "_dmarc.anuntech.com",
  ]);
});

test("DNS health: certo when the internet sees what the server expects", () => {
  const expected = expectedDns(parseZoneFile(ZONE, "anuntech.com"), "anuntech.com");
  const healthy: DnsLookups = {
    mx: { status: "found", records: [{ exchange: "MX1.anuntech.cloud", priority: 10 }] },
    txt: {
      "anuntech.com": { status: "found", records: [["google-site-verification=x"], ["v=spf1 mx include:_spf.google.com -all"]] },
      // Some panels split the key and add spaces: the key still matches.
      "v1-rsa-20261026._domainkey.anuntech.com": { status: "found", records: [["v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx", "yz 123"]] },
      "v1-ed25519-20261026._domainkey.anuntech.com": { status: "found", records: [["v=DKIM1; k=ed25519; h=sha256; p=11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo="]] },
      "_dmarc.anuntech.com": { status: "found", records: [["v=DMARC1; p=quarantine"]] },
    },
  };
  const checks = compareDns(expected, healthy);
  assert.deepEqual(
    checks.map((c) => [c.key, c.status]),
    [
      ["mx", "ok"],
      ["spf", "ok"],
      ["dkim:v1-rsa-20261026", "ok"],
      ["dkim:v1-ed25519-20261026", "ok"],
      ["dmarc", "ok"],
    ],
  );
  assert.ok(checks.every((c) => c.fix === null && c.record === null));
});

test("DNS health: falta isto, with the record to create, when something is missing or wrong", () => {
  const expected = expectedDns(parseZoneFile(ZONE, "anuntech.com"), "anuntech.com");
  const broken: DnsLookups = {
    mx: { status: "found", records: [{ exchange: "mx1.anuntech.cloud", priority: 10 }, { exchange: "aspmx.l.google.com.", priority: 20 }] },
    txt: {
      "anuntech.com": { status: "found", records: [["v=spf1 include:_spf.google.com ~all"], ["v=spf1 mx -all"]] },
      "v1-rsa-20261026._domainkey.anuntech.com": { status: "found", records: [["v=DKIM1; k=rsa; p=OUTRA"]] },
      "v1-ed25519-20261026._domainkey.anuntech.com": { status: "none" },
      "_dmarc.anuntech.com": { status: "error" },
    },
  };
  const checks = Object.fromEntries(compareDns(expected, broken).map((c) => [c.key, c]));
  assert.equal(checks.mx.status, "missing");
  assert.match(checks.mx.fix!, /Apague o MX que aponta para aspmx\.l\.google\.com/);
  assert.equal(checks.spf.status, "missing");
  assert.match(checks.spf.fix!, /Há 2 registros SPF/);
  assert.deepEqual(checks.spf.record, { type: "TXT", name: "anuntech.com", value: "v=spf1 mx -all" });
  assert.equal(checks["dkim:v1-rsa-20261026"].status, "missing");
  assert.match(checks["dkim:v1-rsa-20261026"].fix!, /diferente/);
  assert.equal(checks["dkim:v1-ed25519-20261026"].status, "missing");
  assert.match(checks["dkim:v1-ed25519-20261026"].fix!, /Crie um registro TXT com o nome v1-ed25519-20261026\._domainkey\.anuntech\.com/);
  assert.equal(checks.dmarc.status, "unknown");
  assert.equal(checks.dmarc.fix, null);

  const single = compareDns(expected, {
    mx: { status: "none" },
    txt: { "anuntech.com": { status: "found", records: [["v=spf1 include:_spf.google.com ~all"]] }, "_dmarc.anuntech.com": { status: "none" } },
  });
  const byKey = Object.fromEntries(single.map((c) => [c.key, c]));
  assert.match(byKey.mx.fix!, /Crie um registro MX/);
  assert.match(byKey.spf.fix!, /Acrescente mx/);
  assert.equal(byKey["dkim:v1-rsa-20261026"].status, "unknown");
  assert.match(byKey.dmarc.fix!, /Crie um registro TXT com o nome _dmarc\.anuntech\.com/);
  assert.equal(byKey.dmarc.record?.value, "v=DMARC1; p=reject; rua=mailto:postmaster@anuntech.com");
  const open = compareDns(expected, { mx: { status: "none" }, txt: { "anuntech.com": { status: "found", records: [["v=spf1 mx +all"]] } } });
  assert.match(open.find((c) => c.key === "spf")!.fix!, /qualquer servidor/);
});

test("no text in the area joins sentences with a travessão or shouts", () => {
  const expected = expectedDns(parseZoneFile(ZONE, "anuntech.com"), "anuntech.com");
  const texts = compareDns(expected, { mx: { status: "none" }, txt: {} }).flatMap((c) => [c.title, c.purpose, c.fix ?? ""]);
  for (const t of texts) {
    assert.doesNotMatch(t, /[—–]/, t);
    assert.doesNotMatch(t, /!/, t);
  }
});
