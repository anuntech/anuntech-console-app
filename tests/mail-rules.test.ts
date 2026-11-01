import assert from "node:assert/strict";
import test from "node:test";
import {
  GIB,
  MAIL_CLAIMS_MAX,
  MAIL_DOMAINS,
  addableDomainProblem,
  canManageMail,
  compareDns,
  dnsPanelName,
  domainAddRefusal,
  mailArrival,
  mailContractRefusal,
  ownershipCheck,
  ownershipRecord,
  ownershipToken,
  startingDmarc,
  dnsQuestions,
  expectedDns,
  generatePassword,
  isAnuntechDomain,
  isOwnMailDomain,
  localPartProblem,
  mailRole,
  mailboxAccess,
  managesAnyMail,
  mobileconfig,
  mobileconfigFileName,
  normalizeAddress,
  normalizeLocalPart,
  normalizeMailDomain,
  ownsMailbox,
  parseQuota,
  pickDomain,
  parseRecipients,
  parseZoneFile,
  passwordProblem,
  quotaChoice,
  quotaUse,
  storageLabel,
  type DnsLookups,
} from "../src/lib/mail/mail-rules";

test("anuntech.com is always managed and never a client's", () => {
  assert.deepEqual([...MAIL_DOMAINS], ["anuntech.com"]);
  assert.equal(isOwnMailDomain("ANUNTECH.com"), true);
  assert.equal(isOwnMailDomain("anuntech.com.br"), false);
  assert.equal(isOwnMailDomain(undefined), false);
  for (const domain of ["anuntech.com", "send.anuntech.com", "anuntech.cloud", "teste.anuntech.cloud", "mx1.anuntech.cloud"])
    assert.equal(isAnuntechDomain(domain), true, domain);
  for (const domain of ["anuntech.com.br", "cliente.com.br", "notanuntech.com", "anuntech.cloud.example"])
    assert.equal(isAnuntechDomain(domain), false, domain);
});

test("who manages which mail: the team everything, an Administrador the company's domains, a Membro only their own mailbox", () => {
  const A = "company-a";
  const B = "company-b";
  const team = { admin: true, grants: [] };
  const manager = { admin: false, grants: [{ company: { id: A }, role: "manager" as const }] };
  const member = { admin: false, grants: [{ company: { id: A }, role: "member" as const }] };
  // An identity can be Membro by one alias and Administrador by another: the widest role wins.
  const both = { admin: false, grants: [{ company: { id: A }, role: "member" as const }, { company: { id: A }, role: "manager" as const }] };
  // Assisted access: the team sees company A as its Administrador, without touching its mailboxes.
  const assisted = { admin: false, assisting: { id: A }, grants: [{ company: { id: A }, role: "manager" as const }] };
  const outsider = { admin: false, grants: [] };

  assert.equal(mailRole(team, null), "team");
  assert.equal(mailRole(team, A), "team");
  assert.equal(mailRole(manager, A), "manager");
  assert.equal(mailRole(both, A), "manager");
  assert.equal(mailRole(member, A), "member");
  for (const actor of [manager, member, assisted, outsider]) assert.equal(mailRole(actor, null), null, "Anuntech's own mail is the team's");
  for (const actor of [manager, member]) assert.equal(mailRole(actor, B), null, "another company's domain does not exist for them");
  assert.equal(mailRole(assisted, A), null);
  assert.equal(mailRole({ ...team, assisting: { id: A } }, A), null);

  assert.equal(canManageMail(team, null), true);
  assert.equal(canManageMail(team, B), true);
  assert.equal(canManageMail(manager, A), true);
  assert.equal(canManageMail(manager, B), false);
  assert.equal(canManageMail(member, A), false);
  assert.equal(canManageMail(assisted, A), false);
  assert.equal(canManageMail(outsider, A), false);

  assert.equal(managesAnyMail(team), true);
  assert.equal(managesAnyMail(manager), true);
  assert.equal(managesAnyMail(member), false);
  assert.equal(managesAnyMail(assisted), false);
  assert.equal(managesAnyMail(outsider), false);
});

test("a Membro's mailbox is the one whose address is an e-mail of their account, never an alias", () => {
  const A = "company-a";
  const member = { admin: false, grants: [{ company: { id: A }, role: "member" as const }] };
  const manager = { admin: false, grants: [{ company: { id: A }, role: "manager" as const }] };
  const emails = ["joao@cliente.com.br", "joao.pessoal@gmail.example"];
  const joao = { companyId: A, address: "Joao@Cliente.com.br" };
  const maria = { companyId: A, address: "maria@cliente.com.br" };
  const elsewhere = { companyId: "company-b", address: "joao@cliente.com.br" };

  assert.equal(ownsMailbox("JOAO@cliente.com.br", emails), true);
  assert.equal(ownsMailbox("contato@cliente.com.br", emails), false);
  assert.equal(mailboxAccess(member, joao, emails), "own");
  assert.equal(mailboxAccess(member, maria, emails), null);
  assert.equal(mailboxAccess(member, elsewhere, emails), null, "the address alone is not enough: the company must be theirs");
  assert.equal(mailboxAccess(manager, maria, []), "manage");
  assert.equal(mailboxAccess(manager, elsewhere, emails), null);
  assert.equal(mailboxAccess({ admin: true, grants: [] }, { companyId: null, address: "kauan@anuntech.com" }, []), "manage");
  assert.equal(mailboxAccess({ ...member, assisting: { id: A } }, joao, emails), null);
});

test("domains: lower case and ASCII, without the final dot or a leading @; anything else is refused", () => {
  assert.equal(normalizeMailDomain("  Cliente.COM.br. "), "cliente.com.br");
  assert.equal(normalizeMailDomain("@empresa.com"), "empresa.com");
  assert.equal(normalizeMailDomain("açaí.com.br"), "xn--aa-4iaz.com.br");
  assert.equal(normalizeMailDomain("xn--aa-4iaz.com.br"), "xn--aa-4iaz.com.br");
  assert.equal(normalizeMailDomain("mail.cliente.com.br"), "mail.cliente.com.br");
  for (const raw of [
    "",
    "localhost",
    "cliente",
    "1.2.3.4",
    "cliente.c",
    "cliente.123",
    "-cliente.com",
    "cliente-.com",
    "cli_ente.com",
    "cliente..com",
    "joao@cliente.com",
    "https://cliente.com",
    "cliente.com/admin",
    "cliente.com:25",
    "cliente.com?x=1",
    "cli ente.com",
    "[::1]",
    `${"a".repeat(64)}.com`,
    `${"a.".repeat(127)}com`,
  ])
    assert.equal(normalizeMailDomain(raw), null, JSON.stringify(raw));
});

test("the domain a page shows: the one asked for when managed, else Anuntech's own, else the first", () => {
  const choices = [{ domain: "cliente.com.br" }, { domain: "anuntech.com" }, { domain: "outro.com" }];
  assert.equal(pickDomain(choices, undefined)?.domain, "anuntech.com");
  assert.equal(pickDomain(choices, "")?.domain, "anuntech.com");
  assert.equal(pickDomain(choices, " Outro.COM ")?.domain, "outro.com");
  assert.equal(pickDomain(choices, "naogerenciado.com"), undefined);
  assert.equal(pickDomain(choices, "não é domínio"), undefined);
  assert.equal(pickDomain(choices, ["outro.com"]), choices[1]);
  assert.equal(pickDomain([{ domain: "cliente.com.br" }], undefined)?.domain, "cliente.com.br");
  assert.equal(pickDomain([], undefined), null);
  assert.equal(pickDomain([], "cliente.com.br"), undefined);
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
    hosts: {
      "autoconfig.anuntech.com": { cname: { status: "found", records: ["mail.anuntech.com."] }, a: { status: "none" } },
      // An A record with the server's own address points at it as well as the CNAME.
      "autodiscover.anuntech.com": { cname: { status: "none" }, a: { status: "found", records: ["203.0.113.10"] } },
    },
    targets: { "mail.anuntech.com": { status: "found", records: ["203.0.113.10"] } },
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
      // mail.anuntech.com is the target itself: nothing to point.
      ["host:autoconfig", "ok"],
      ["host:autodiscover", "ok"],
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
  // The server's zone asks for p=reject; the record to create starts at p=none.
  assert.equal(byKey.dmarc.record?.value, "v=DMARC1; p=none; rua=mailto:postmaster@anuntech.com");
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

// The client's own setup -------------------------------------------------

/** A zone as the server writes it for a new client domain (mx1, 01/11/2026), CAA and DMARC p=reject included. */
const CLIENT_ZONE = `v1-ed25519-20261101._domainkey.cliente.com.br. IN TXT "v=DKIM1; k=ed25519; h=sha256; p=EDKEY="
v1-rsa-20261101._domainkey.cliente.com.br. IN TXT (
    "v=DKIM1; k=rsa; h=sha256; p=MIIB"
    "IDAQAB"
)
cliente.com.br. IN TXT "v=spf1 mx -all"
cliente.com.br. IN MX 10 mx1.anuntech.cloud.
_dmarc.cliente.com.br. IN TXT "v=DMARC1; p=reject; rua=mailto:postmaster@cliente.com.br"
cliente.com.br. IN CAA 0 issue "letsencrypt.org;accounturi=https://acme-v02.api.letsencrypt.org/acme/acct/1"
mta-sts.cliente.com.br. IN CNAME mx1.anuntech.cloud.
autoconfig.cliente.com.br. IN CNAME mx1.anuntech.cloud.
autodiscover.cliente.com.br. IN CNAME mx1.anuntech.cloud.
`;

test("ownership: a random token, the _anuntech TXT and the check that only the exact value proves it", () => {
  const token = ownershipToken();
  assert.equal(token.length, 24);
  assert.match(token, /^[A-HJ-NP-Za-km-z2-9]+$/);
  assert.notEqual(ownershipToken(), token);
  const record = ownershipRecord("cliente.com.br", token);
  assert.deepEqual(record, { type: "TXT", name: "_anuntech.cliente.com.br", value: `anuntech-verificacao=${token}` });
  const proved = ownershipCheck("cliente.com.br", token, { status: "found", records: [["outra-coisa"], ["anuntech-verificacao=", token]] });
  assert.equal(proved.status, "ok");
  assert.equal(proved.stage, "proof");
  const wrong = ownershipCheck("cliente.com.br", token, { status: "found", records: [["anuntech-verificacao=outro"]] });
  assert.equal(wrong.status, "missing");
  assert.match(wrong.fix!, /não tem o valor certo/);
  assert.deepEqual(wrong.record, record);
  assert.equal(ownershipCheck("cliente.com.br", token, { status: "none" }).status, "missing");
  // A failed lookup is never a proof, and never a refusal either.
  assert.equal(ownershipCheck("cliente.com.br", token, { status: "error" }).status, "unknown");
});

test("adding a domain: a real name, never Anuntech's, only the Administrador with the e-mail active", () => {
  assert.match(addableDomainProblem(null)!, /Digite o domínio/);
  assert.match(addableDomainProblem("anuntech.com")!, /da Anuntech/);
  assert.match(addableDomainProblem("mx1.anuntech.cloud")!, /da Anuntech/);
  assert.equal(addableDomainProblem("mulheresfm.com.br"), null);
  const base = { role: "manager" as const, archived: false, product: "active" as const, pending: 0 };
  assert.equal(domainAddRefusal(base), null);
  assert.match(domainAddRefusal({ ...base, role: "member" })!, /Só o Administrador/);
  assert.match(domainAddRefusal({ ...base, role: null })!, /Só o Administrador/);
  assert.match(domainAddRefusal({ ...base, product: "none" })!, /Contrate o e-mail/);
  assert.match(domainAddRefusal({ ...base, product: "suspended" })!, /não está ativo/);
  assert.match(domainAddRefusal({ ...base, archived: true })!, /arquivada/);
  assert.match(domainAddRefusal({ ...base, pending: MAIL_CLAIMS_MAX })!, /5 domínios esperando/);
  // The team adds a domain for a company without the product (it links products itself).
  assert.equal(domainAddRefusal({ ...base, role: "team", product: "none" }), null);
});

test("contracting the e-mail: the Administrador of a company in good standing, once", () => {
  const base = { role: "manager" as const, archived: false, product: "none" as const, overdue: 0, suspended: false };
  assert.equal(mailContractRefusal(base), null);
  assert.equal(mailContractRefusal({ ...base, role: "team" }), null);
  assert.match(mailContractRefusal({ ...base, role: "member" })!, /Só o Administrador/);
  assert.match(mailContractRefusal({ ...base, product: "active" })!, /já tem o e-mail/);
  assert.match(mailContractRefusal({ ...base, product: "suspended" })!, /já tem o e-mail/);
  assert.match(mailContractRefusal({ ...base, overdue: 1 })!, /uma fatura vencida/);
  assert.match(mailContractRefusal({ ...base, overdue: 3 })!, /3 faturas vencidas/);
  assert.match(mailContractRefusal({ ...base, suspended: true })!, /produto suspenso/);
  assert.match(mailContractRefusal({ ...base, archived: true })!, /arquivada/);
});

test("the DNS guide: DKIM and DMARC now, MX, SPF and the apps' names at the switch, never CAA", () => {
  const expected = expectedDns(parseZoneFile(CLIENT_ZONE, "cliente.com.br"), "cliente.com.br");
  assert.deepEqual(
    expected.hosts.map((h) => [h.name, h.target]),
    [
      ["mail.cliente.com.br", "mx1.anuntech.cloud"],
      ["autoconfig.cliente.com.br", "mx1.anuntech.cloud"],
      ["autodiscover.cliente.com.br", "mx1.anuntech.cloud"],
    ],
  );
  // Coming from another provider: the mail still lands there, and nothing is published yet.
  const before = compareDns(expected, {
    mx: { status: "found", records: [{ exchange: "mx.provedor.example", priority: 10 }] },
    txt: { "cliente.com.br": { status: "found", records: [["v=spf1 include:provedor.example ~all"]] }, "_dmarc.cliente.com.br": { status: "none" } },
    hosts: {
      "mail.cliente.com.br": { cname: { status: "none" }, a: { status: "found", records: ["198.51.100.7"] } },
      "autoconfig.cliente.com.br": { cname: { status: "found", records: ["outro.example."] }, a: { status: "none" } },
      "autodiscover.cliente.com.br": { cname: { status: "none" }, a: { status: "none" } },
    },
    targets: { "mx1.anuntech.cloud": { status: "found", records: ["203.0.113.10"] } },
  });
  const stages = Object.fromEntries(before.map((c) => [c.key, c.stage]));
  assert.deepEqual(stages, {
    mx: "switch",
    spf: "switch",
    "dkim:v1-ed25519-20261101": "now",
    "dkim:v1-rsa-20261101": "now",
    dmarc: "now",
    "host:mail": "switch",
    "host:autoconfig": "switch",
    "host:autodiscover": "switch",
  });
  assert.ok(!before.some((c) => /caa/i.test(c.key) || /CAA|letsencrypt/.test(JSON.stringify(c.record ?? ""))));
  const byKey = Object.fromEntries(before.map((c) => [c.key, c]));
  assert.equal(byKey.dmarc.record?.value, startingDmarc("cliente.com.br"));
  assert.equal(startingDmarc("cliente.com.br"), "v=DMARC1; p=none; rua=mailto:postmaster@cliente.com.br");
  assert.match(byKey["host:mail"].fix!, /aponta para outro servidor/);
  assert.match(byKey["host:mail"].fix!, /nuvem cinza/);
  assert.deepEqual(byKey["host:mail"].record, { type: "CNAME", name: "mail.cliente.com.br", value: "mx1.anuntech.cloud" });
  assert.match(byKey["host:autoconfig"].fix!, /Troque o CNAME para mx1\.anuntech\.cloud/);
  assert.match(byKey["host:autodiscover"].fix!, /Crie um registro CNAME/);
  assert.equal(mailArrival(before), "elsewhere");
  // After the switch: the MX here, and the names pointing at the server.
  const after = compareDns(expected, {
    mx: { status: "found", records: [{ exchange: "mx1.anuntech.cloud.", priority: 10 }] },
    txt: {},
    hosts: {
      "mail.cliente.com.br": { cname: { status: "found", records: ["mx1.anuntech.cloud"] }, a: { status: "none" } },
      "autoconfig.cliente.com.br": { cname: { status: "error" }, a: { status: "none" } },
    },
  });
  assert.equal(mailArrival(after), "here");
  assert.equal(after.find((c) => c.key === "host:mail")?.status, "ok");
  assert.equal(after.find((c) => c.key === "host:autoconfig")?.status, "unknown");
  assert.equal(after.find((c) => c.key === "host:autodiscover")?.status, "unknown");
  assert.equal(mailArrival(compareDns(expected, { mx: { status: "none" }, txt: {} })), "none");
  assert.equal(mailArrival(compareDns(expected, { mx: { status: "error" }, txt: {} })), "unknown");
});

test("the name as DNS panels take it", () => {
  assert.equal(dnsPanelName("_anuntech.cliente.com.br", "cliente.com.br"), "_anuntech");
  assert.equal(dnsPanelName("v1-rsa-20261101._domainkey.cliente.com.br", "cliente.com.br"), "v1-rsa-20261101._domainkey");
  assert.equal(dnsPanelName("cliente.com.br", "cliente.com.br"), "@");
  assert.equal(dnsPanelName("outro.com.br", "cliente.com.br"), "outro.com.br");
});
