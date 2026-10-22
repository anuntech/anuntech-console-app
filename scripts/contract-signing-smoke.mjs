import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Signatures belong to a version: going back to draft or a review round keeps
 * them on record, and the next version is signed again by both parties. Until
 * 0042 the database allowed one signature per party per contract, and the
 * second one failed in production (16/10/2026) with the query and the
 * signer's e-mail and IP on screen.
 */
export async function runContractSigningTests({ database, ids, request, ok, marker, base }) {
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  const actionId = (name) => {
    const found = Object.entries(manifest).filter(([, action]) => action.exportedName === name);
    assert.equal(found.length, 1, `Ação ${name} encontrada no build`);
    return found[0][0];
  };
  // The call a page makes with JavaScript on: the reply is what the action
  // returned, even when the page no longer shows the form that sent it.
  const call = async (page, who, name, values) => {
    // As React's encodeReply writes it: the fields of the FormData argument as "_1_<name>", then the
    // arguments as "0", last, because the server builds that FormData from the fields read before it.
    const body = new FormData();
    for (const [key, value] of Object.entries(values)) body.append(`_1_${key}`, value);
    body.set("0", JSON.stringify([null, "$K1"]));
    const r = await request(page, who, {
      method: "POST",
      body,
      headers: { Origin: base, "Next-Action": actionId(name), Accept: "text/x-component" },
    });
    assert.equal(r.status, 200, `${name} respondeu ${r.status}`);
    return r.text;
  };
  const one = async (sql, values = []) => (await database.query(sql, values)).rows[0];
  const contractRow = (id) => one("select * from console_contracts where id=$1", [id]);
  const signatures = async (id) =>
    (
      await database.query(
        "select party, document_hash from console_contract_signatures where contract_id=$1 order by created_at, party",
        [id],
      )
    ).rows;
  const act = (id, who, action, values = { id }) => call(`/contratos/${id}`, who, action, values);
  const send = (id) => act(id, "admin", "sendContract");
  const revert = (id) => act(id, "admin", "revertContract");
  const sign = (id, who) => act(id, who, "signContract", { id, consent: "on" });
  const ask = (id, comment) =>
    // Block 1 is the first paragraph; headings take no requests.
    act(id, "finance", "saveChangeRequest", { contractId: id, requestId: "", blockIndex: "1", comment, proposedText: "" });
  const leaked = (...replies) => replies.some((text) => text.includes("Failed query") || text.includes("params:"));
  const twiceMessage = "Esta parte já assinou esta versão do contrato.";
  // Holds the contract's row while the calls start, and lets go once all of them wait on it: the
  // signatures then really overlap, instead of depending on which request happens to be slower.
  const atOnce = async (id, calls) => {
    const holder = await database.connect();
    try {
      await holder.query("begin");
      await holder.query("select id from console_contracts where id=$1 for update", [id]);
      const replies = calls.map((run) => run());
      for (let tries = 0; tries < 150; tries++) {
        const { waiting } = (
          await database.query(
            "select count(*)::int as waiting from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'",
          )
        ).rows[0];
        if (waiting >= calls.length) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await holder.query("commit");
      return await Promise.all(replies);
    } finally {
      holder.release();
    }
  };
  const create = async (title) => {
    await call("/contratos/novo", "admin", "createContract", { companyId: ids.a, title });
    const row = await one("select id from console_contracts where company_id=$1 and title=$2", [ids.a, title]);
    assert.ok(row, `Contrato ${title} criado`);
    await database.query("update console_contracts set body=$2 where id=$1", [
      row.id,
      `CLÁUSULA 1. Objeto.\n\nPrestação de serviços ${marker}.\n\nCLÁUSULA 2. Prazo.\n\nDoze meses.`,
    ]);
    return row.id;
  };

  ok(
    (await one("select indexdef from pg_indexes where indexname='console_contract_signature_version_party_unique'"))?.indexdef.includes(
      "(contract_id, document_hash, party)",
    ) && !(await one("select 1 as found from pg_indexes where indexname='console_contract_signature_party_unique'")),
    "Assinatura é única por parte e versão, não por contrato",
  );

  // Resending the signature e-mail: not right after a send (a double click), again later, never once the client signed.
  const notice = await create(`Resend ${marker}`);
  await send(notice);
  const resent = async () =>
    (await one("select count(*)::int as n from console_audit_events where entity_id=$1 and action='contract.notice_resent'", [notice])).n;
  await act(notice, "admin", "resendContract");
  ok((await resent()) === 0, "Reenvio do e-mail logo depois do envio do contrato é recusado");
  await database.query("update console_audit_events set created_at = now() - interval '10 minutes' where entity_id=$1 and action='contract.sent'", [notice]);
  await act(notice, "finance", "resendContract");
  ok((await resent()) === 0, "Cliente não reenvia o e-mail do contrato");
  await act(notice, "admin", "resendContract");
  ok((await resent()) === 1, "A equipe reenvia o e-mail de assinatura minutos depois");
  await database.query("update console_audit_events set created_at = now() - interval '10 minutes' where entity_id=$1", [notice]);
  await sign(notice, "finance");
  await act(notice, "admin", "resendContract");
  ok((await resent()) === 1, "Depois que o cliente assina, não há e-mail para reenviar");

  // The production case: the team signed version 1, the contract went back to draft, and the team signs version 2.
  const team = await create(`Resign team ${marker}`);
  await send(team);
  const teamV1 = (await contractRow(team)).document_hash;
  await sign(team, "admin");
  const twice = await sign(team, "admin");
  ok((await signatures(team)).length === 1 && twice.includes(twiceMessage), "A mesma parte não assina duas vezes a mesma versão");
  await revert(team);
  await send(team);
  let c = await contractRow(team);
  ok(c.status === "sent" && c.published_version === 2 && c.document_hash !== teamV1, "O reenvio é a versão 2, com outro hash");
  const again = await sign(team, "admin");
  ok(
    !leaked(again) && (await signatures(team)).filter((s) => s.party === "anuntech").length === 2,
    "A Anuntech assina a versão 2 depois de ter assinado a 1",
  );
  await sign(team, "finance");
  c = await contractRow(team);
  let rows = await signatures(team);
  ok(
    c.status === "signed" &&
      c.signed_pdf &&
      rows.filter((s) => s.document_hash === teamV1).map((s) => s.party).join() === "anuntech" &&
      rows
        .filter((s) => s.document_hash === c.document_hash)
        .map((s) => s.party)
        .sort()
        .join() === "anuntech,client",
    "Com as duas assinaturas da versão 2 o contrato fecha, e a da versão 1 fica no histórico",
  );

  // The client signed version 1; after the team reopens it, the client signs version 2.
  const client = await create(`Resign client ${marker}`);
  await send(client);
  await sign(client, "finance");
  const late = await ask(client, `Depois de assinar ${marker}`);
  ok(
    !(await one("select id from console_contract_change_requests where contract_id=$1", [client])) &&
      late.includes("A sua empresa já assinou esta versão. Se algo precisa mudar, abra um chamado."),
    "Depois de assinar, a empresa não abre pedido de alteração por POST direto",
  );
  await revert(client);
  ok(
    (await one("select details from console_audit_events where entity_id=$1 and action='contract.reverted'", [client])).details
      .signaturesVoided === 1,
    "Voltar para rascunho registra a assinatura que deixou de valer",
  );
  await send(client);
  const clientAgain = await sign(client, "finance");
  ok(
    !leaked(clientAgain) && (await signatures(client)).filter((s) => s.party === "client").length === 2,
    "O cliente assina a versão 2 depois de ter assinado a 1",
  );
  await sign(client, "admin");
  ok((await contractRow(client)).status === "signed", "A versão 2 assinada pelas duas partes fecha o contrato");

  // Same thing through a review round (sent, in review, version 2), with no going back to draft.
  const review = await create(`Resign review ${marker}`);
  await send(review);
  await sign(review, "admin");
  await ask(review, `Ajuste ${marker}`);
  await act(review, "finance", "submitChangeRequests", { contractId: review });
  const pending = await one("select id from console_contract_change_requests where contract_id=$1", [review]);
  ok(
    (await contractRow(review)).status === "in_review" && pending,
    "O pedido do cliente põe em revisão um contrato que a Anuntech já assinou",
  );
  await act(review, "admin", "decideChangeRequest", { id: pending.id, decision: "decline", response: "Mantido." });
  await send(review);
  const afterReview = await sign(review, "admin");
  ok(
    !leaked(afterReview) &&
      (await contractRow(review)).published_version === 2 &&
      (await signatures(review)).filter((s) => s.party === "anuntech").length === 2,
    "Depois de uma rodada de revisão a Anuntech assina a nova versão",
  );

  // Both parties at the same moment: each signature waits for the other, and the second one closes the contract.
  const together = await create(`Sign together ${marker}`);
  await send(together);
  const both = await atOnce(together, [() => sign(together, "finance"), () => sign(together, "admin")]);
  c = await contractRow(together);
  ok(
    !leaked(...both) && c.status === "signed" && c.signed_pdf && (await signatures(together)).length === 2,
    "As duas partes assinando ao mesmo tempo fecham o contrato",
  );

  // The same party twice at the same moment (two tabs): one signature, and a plain answer for the other,
  // whether the check under the lock answers it or, if that ever changes, the unique index does.
  const tabs = await create(`Sign twice ${marker}`);
  await send(tabs);
  const pair = await atOnce(tabs, [() => sign(tabs, "admin"), () => sign(tabs, "admin")]);
  ok(
    !leaked(...pair) && (await signatures(tabs)).length === 1 && pair.filter((text) => text.includes(twiceMessage)).length === 1,
    "Duas abas da mesma parte gravam uma assinatura só, e a outra lê que esta parte já assinou",
  );
}
