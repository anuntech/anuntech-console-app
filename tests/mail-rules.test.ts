import assert from "node:assert/strict";
import test from "node:test";
import {
  canOpenMailbox,
  composeDraft,
  folderName,
  linkify,
  listDateLabel,
  mailboxesFor,
  mailHref,
  mailQuery,
  parseAddressList,
  prefixedSubject,
  quoteFor,
  safeFileName,
  sortFolders,
} from "../src/lib/mail/mail-rules";

test("only the team opens a mailbox, and only its own verified address on anuntech.com", () => {
  const team = { admin: true, emails: ["Kauan@Anuntech.com", "kauan@gmail.com", "kauan@anuntech.com", "hi@anuntech.com.br"] };
  assert.deepEqual(mailboxesFor(team), ["kauan@anuntech.com"]);
  assert.ok(canOpenMailbox(team, " KAUAN@anuntech.com "));
  // Another team member's address, a shared mailbox and a look-alike domain are not this person's.
  assert.ok(!canOpenMailbox(team, "ana@anuntech.com"));
  assert.ok(!canOpenMailbox(team, "hi@anuntech.com"));
  assert.ok(!canOpenMailbox(team, "kauan@anuntech.com.br"));
  assert.ok(!canOpenMailbox(team, "kauan@evil-anuntech.com"));
  // A client with the same address on the account still opens nothing.
  const client = { admin: false, emails: ["kauan@anuntech.com"] };
  assert.deepEqual(mailboxesFor(client), []);
  assert.ok(!canOpenMailbox(client, "kauan@anuntech.com"));
  assert.deepEqual(mailboxesFor({ admin: true, emails: [] }), []);
});

test("folders: the special ones first in Portuguese, then the rest by order and name", () => {
  const sorted = sortFolders([
    { id: "6", name: "Projetos", role: null, sortOrder: 0 },
    { id: "1", name: "Deleted Items", role: "trash" },
    { id: "2", name: "INBOX", role: "inbox" },
    { id: "3", name: "Junk Mail", role: "junk" },
    { id: "4", name: "Sent Items", role: "sent" },
    { id: "5", name: "Drafts", role: "drafts" },
    { id: "7", name: "Clientes", role: null, sortOrder: 0 },
    { id: "8", name: "Archive", role: "archive" },
  ]);
  assert.deepEqual(sorted.map(folderName), ["Entrada", "Rascunhos", "Enviados", "Arquivo", "Spam", "Lixeira", "Clientes", "Projetos"]);
});

test("the address bar keeps only what it can trust", () => {
  const q = mailQuery({ caixa: " Kauan@Anuntech.com ", pasta: "a1", msg: "../x", q: "  boleto  ", pagina: "3" });
  assert.deepEqual(q, { caixa: "kauan@anuntech.com", pasta: "a1", msg: "", q: "boleto", pagina: 3 });
  assert.equal(mailQuery({ pagina: "-2" }).pagina, 1);
  assert.equal(mailHref({ caixa: "a@anuntech.com", pasta: "p", q: "x y", pagina: 2, msg: "m" }), "/email?caixa=a%40anuntech.com&pasta=p&q=x+y&pagina=2&msg=m");
  assert.equal(mailHref({ caixa: "a@anuntech.com", pagina: 1 }, { single: true }), "/email");
});

test("recipients: commas or semicolons, names with or without quotes, each address checked", () => {
  const parsed = parseAddressList('Ana <ana@x.com>; "Silva, João" <joao@y.com.br>, bia@z.org, ana@x.com');
  assert.deepEqual(parsed, {
    ok: true,
    addresses: [{ name: "Ana", email: "ana@x.com" }, { name: "Silva, João", email: "joao@y.com.br" }, { email: "bia@z.org" }],
  });
  assert.deepEqual(parseAddressList("ana@x.com, nao-e-email"), { ok: false, invalid: "nao-e-email" });
  assert.deepEqual(parseAddressList("a@b"), { ok: false, invalid: "a@b" });
  assert.deepEqual(parseAddressList("   "), { ok: true, addresses: [] });
  // A header injection attempt is not an address, and a name keeps to one line.
  assert.equal(parseAddressList("a@b.com\r\nBcc: c@d.com").ok, false);
  assert.deepEqual(parseAddressList("Ana\r\nBcc: x <ana@x.com>"), { ok: true, addresses: [{ name: "Ana Bcc: x", email: "ana@x.com" }] });
});

test("subjects get Re: and Enc: once", () => {
  assert.equal(prefixedSubject("Proposta", "reply"), "Re: Proposta");
  assert.equal(prefixedSubject("RE: Proposta", "reply"), "RE: Proposta");
  assert.equal(prefixedSubject("Fwd: Proposta", "forward"), "Fwd: Proposta");
  assert.equal(prefixedSubject("Proposta", "forward"), "Enc: Proposta");
  assert.equal(prefixedSubject("", "reply"), "Re:");
});

const original = {
  from: [{ name: "Ana", email: "ana@cliente.com" }],
  to: [{ name: "Kauan", email: "kauan@anuntech.com" }, { email: "bia@anuntech.com" }],
  cc: [{ email: "carlos@cliente.com" }, { email: "KAUAN@anuntech.com" }],
  replyTo: null,
  subject: "Orçamento",
  sentAt: "2026-10-31T17:05:00Z",
  messageId: ["abc@cliente.com"],
  references: ["root@cliente.com"],
  text: "Oi,\n\nsegue o orçamento.",
};

test("a reply goes to the sender, quotes the original and keeps the thread", () => {
  const draft = composeDraft("reply", original, "kauan@anuntech.com");
  assert.equal(draft.to, "Ana <ana@cliente.com>");
  assert.equal(draft.cc, "");
  assert.equal(draft.subject, "Re: Orçamento");
  assert.deepEqual(draft.inReplyTo, ["abc@cliente.com"]);
  assert.deepEqual(draft.references, ["root@cliente.com", "abc@cliente.com"]);
  assert.match(draft.body, /^\n\nEm 31\/10\/2026 às 14:05, Ana escreveu:\n> Oi,\n>\n> segue o orçamento\.$/);
  // Reply-To wins over From.
  assert.equal(composeDraft("reply", { ...original, replyTo: [{ email: "vendas@cliente.com" }] }, "kauan@anuntech.com").to, "vendas@cliente.com");
});

test("reply-all copies the others, never the mailbox itself", () => {
  const draft = composeDraft("replyAll", original, "kauan@anuntech.com");
  assert.equal(draft.to, "Ana <ana@cliente.com>");
  assert.equal(draft.cc, "bia@anuntech.com, carlos@cliente.com");
  // Replying to one's own sent message goes to its recipients again.
  const mine = composeDraft("reply", { ...original, from: [{ email: "kauan@anuntech.com" }], to: [{ email: "ana@cliente.com" }] }, "kauan@anuntech.com");
  assert.equal(mine.to, "ana@cliente.com");
});

test("a forward starts empty with Enc: and the original below", () => {
  const draft = composeDraft("forward", original, "kauan@anuntech.com");
  assert.equal(draft.to, "");
  assert.equal(draft.subject, "Enc: Orçamento");
  assert.deepEqual(draft.inReplyTo, []);
  assert.match(draft.body, /Mensagem encaminhada/);
  assert.match(draft.body, /De: Ana <ana@cliente.com>/);
  assert.match(draft.body, /segue o orçamento\.$/);
  assert.match(quoteFor({ ...original, from: [], sentAt: null }), /^\(sem remetente\) escreveu:/);
});

test("text links: web and e-mail addresses only, without the closing punctuation", () => {
  assert.deepEqual(linkify("Veja https://anuntech.com/x. Ou escreva para oi@anuntech.com, ok? javascript:alert(1)"), [
    { text: "Veja " },
    { text: "https://anuntech.com/x", href: "https://anuntech.com/x" },
    { text: ". Ou escreva para " },
    { text: "oi@anuntech.com", href: "mailto:oi@anuntech.com" },
    { text: ", ok? javascript:alert(1)" },
  ]);
});

test("list dates in São Paulo: the hour today, ontem, the day this year, the date before", () => {
  const now = new Date("2026-10-31T15:00:00Z");
  assert.equal(listDateLabel("2026-10-31T12:30:00Z", now), "09:30");
  // 01:30 UTC on the 31st is still the 30th in São Paulo.
  assert.equal(listDateLabel("2026-10-31T01:30:00Z", now), "ontem");
  assert.equal(listDateLabel("2026-03-02T12:00:00Z", now), "2 mar");
  assert.equal(listDateLabel("2025-12-24T12:00:00Z", now), "24/12/2025");
});

test("download names lose paths and control characters", () => {
  assert.equal(safeFileName("../../etc/passwd"), "passwd");
  assert.equal(safeFileName('a"b\r\n.pdf'), "ab.pdf");
  assert.equal(safeFileName(""), "anexo");
  assert.equal(safeFileName(".."), "anexo");
});
