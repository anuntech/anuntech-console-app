import { createHash, randomBytes, randomUUID } from "node:crypto";

/**
 * App de reuniões do Mac: conectar pelo navegador (PKCE), trocar o código pela
 * chave, listar destinos, salvar notas como bookmarks e desconectar. Cobre o
 * que não pode passar: código reaproveitado, verificador errado, código
 * vencido, outra empresa, o espaço da Anuntech para quem não é da equipe,
 * chave revogada e membro desligado.
 */
export async function runMeetingTests({ database: db, ids, people, request, submitForm, ok, marker, base, notFoundPage }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const pkce = () => {
    const verifier = randomBytes(32).toString("base64url");
    return { verifier, challenge: createHash("sha256").update(verifier).digest("hex") };
  };
  // Posted from the page's own form (hidden inputs, $ACTION_KEY included): only then does
  // Next render the action's answer, the app's link with the code, into the page.
  const approve = async (who, challenge) => {
    const r = await submitForm(`/conectar/${challenge}`, who, who, "challenge", { challenge });
    return r.text.match(/anuntech-reunioes:\/\/conectado\?code=([A-Za-z0-9_-]{43})/)?.[1] ?? null;
  };
  const exchange = (code, verifier, device = `Mac QA ${marker}`) =>
    fetch(`${base}/api/reunioes/conexao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, verifier, device }),
    });
  const connect = async (who) => {
    const { verifier, challenge } = pkce();
    const code = await approve(who, challenge);
    const r = await exchange(code, verifier);
    return r.status === 200 ? (await r.json()).token : null;
  };
  const api = (path, token, init = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  const note = (overrides = {}) => ({
    noteId: randomUUID(),
    space: ids.a,
    folderId: null,
    title: `Reunião QA ${marker}`,
    fileName: "2026-10-16-1430.md",
    markdown: `# Reunião QA ${marker}\n\n## Resumo\n\n- RESUMO-${marker}\n\n## Próximos passos\n\n- [ ] **QA:** conferir\n\n---\n\n## Transcrição\n\n[00:00] FALA-${marker}\n`,
    startedAt: "2026-10-16T14:30:00-03:00",
    durationSeconds: 2520,
    ...overrides,
  });
  const send = (token, body) =>
    api("/api/reunioes/notas", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const folderB = randomUUID();

  try {
    await db.query("insert into console_bookmark_folders(id,company_id,owner_id,name) values($1,$2,$3,$4)", [
      folderB,
      ids.b,
      people.admin.id,
      `Pasta B ${marker}`,
    ]);

    // Conectar pelo navegador.
    const first = pkce();
    let r = await request(`/conectar/${first.challenge}`);
    ok(
      r.status === 307 && r.headers.get("location")?.includes(`/entrar?volta=/conectar/${first.challenge}`),
      "Conectar sem sessão leva ao login e volta para a conexão",
    );
    ok(notFoundPage(await request("/conectar/nao-e-um-desafio", "support")), "Conexão com desafio inválido não existe");
    r = await request(`/conectar/${first.challenge}`, "support");
    ok(r.status === 200 && r.text.includes("Conectar este Mac") && r.text.includes(people.support.email), "Página de conexão mostra a conta e o botão");
    const firstCode = await approve("support", first.challenge);
    ok(!!firstCode, "Aprovar devolve o código para o esquema do app");
    ok((await exchange(firstCode, pkce().verifier)).status === 400, "Código com verificador errado é recusado");
    ok((await exchange(firstCode, first.verifier)).status === 400, "Verificador errado queima o código");

    const second = pkce();
    const secondCode = await approve("support", second.challenge);
    r = await exchange(secondCode, second.verifier);
    const connected = r.status === 200 ? await r.json() : {};
    ok(/^anr_[A-Za-z0-9_-]{43}$/.test(connected.token ?? "") && connected.person?.email === people.support.email, "Código e verificador certos viram a chave da pessoa");
    ok((await exchange(secondCode, second.verifier)).status === 400, "O mesmo código não vale duas vezes");
    const row = await one("select token_hash, code_hash, challenge, device from console_app_connections where token_hash=$1", [
      createHash("sha256").update(connected.token).digest("hex"),
    ]);
    ok(!!row && row.code_hash === null && row.challenge === null && row.device === `Mac QA ${marker}`, "O banco guarda só o hash da chave e o nome do Mac");

    const late = pkce();
    const lateCode = await approve("support", late.challenge);
    await db.query("update console_app_connections set code_expires_at=now()-interval '1 minute' where challenge=$1", [late.challenge]);
    ok((await exchange(lateCode, late.verifier)).status === 400, "Código vencido é recusado");

    const token = connected.token;
    // Destinos.
    ok((await api("/api/reunioes/destinos")).status === 401, "Destinos sem chave: 401");
    ok((await api("/api/reunioes/destinos", `anr_${randomBytes(32).toString("base64url")}`)).status === 401, "Chave desconhecida: 401");
    r = await api("/api/reunioes/destinos", token);
    const destinations = r.status === 200 ? await r.json() : { spaces: [] };
    const spaceIds = destinations.spaces.map((space) => space.id);
    ok(spaceIds.includes(ids.a) && !spaceIds.includes(ids.b) && !spaceIds.includes("internal"), "Membro vê só a própria empresa entre os destinos");
    ok(!JSON.stringify(destinations).includes(`Pasta B ${marker}`), "Pasta de outra empresa não aparece nos destinos");

    // Notas.
    const body = note();
    r = await send(token, body);
    const saved = r.status === 201 ? await r.json() : {};
    ok(!!saved.id && saved.url?.endsWith(`/bookmarks/${saved.id}/reuniao`), "Nota salva vira bookmark e devolve o link do leitor");
    const bookmark = await one("select company_id, file_name, meeting, convert_from(content,'UTF8') as text from console_bookmarks where id=$1", [saved.id]);
    ok(
      bookmark?.company_id === ids.a &&
        bookmark.file_name === "2026-10-16-1430.md" &&
        bookmark.meeting?.noteId === body.noteId &&
        bookmark.text.includes(`RESUMO-${marker}`),
      "Bookmark guarda o Markdown e os dados da reunião",
    );
    r = await send(token, body);
    ok(r.status === 200 && (await r.json()).id === saved.id, "Reenviar a mesma nota não duplica o bookmark");
    ok((await send(token, note({ space: ids.b }))).status === 403, "Membro não salva nota em outra empresa");
    ok((await send(token, note({ space: "internal" }))).status === 403, "Membro não salva no espaço da Anuntech");
    ok((await send(token, note({ folderId: folderB }))).status === 403, "Membro não salva em pasta de outra empresa");
    ok((await send(token, note({ fileName: "../x.md" }))).status === 400, "Nome de arquivo fora do padrão é recusado");
    ok((await send(null, note())).status === 401, "Nota sem chave: 401");
    ok(
      (await db.query("select id from console_bookmarks where title=$1", [`Reunião QA ${marker}`])).rowCount === 1,
      "Só a nota permitida foi gravada",
    );

    // Leitor no Console.
    r = await request(`/bookmarks/${saved.id}/reuniao`, "support");
    ok(r.status === 200 && r.text.includes(`RESUMO-${marker}`) && r.text.includes(`FALA-${marker}`) && r.text.includes("Baixar .md"), "Leitor mostra resumo e transcrição");
    ok(r.text.includes("42 min"), "Leitor mostra a duração da reunião");
    ok(notFoundPage(await request(`/bookmarks/${saved.id}/reuniao`, "outsider")), "Outra conta não abre a nota");
    r = await request("/bookmarks", "finance");
    ok(r.text.includes(`/bookmarks/${saved.id}/reuniao`) && r.text.includes("Reunião · 42 min"), "A lista de Bookmarks abre a nota no leitor");
    r = await request(`/api/bookmarks/${saved.id}`, "finance");
    ok(r.status === 200 && r.text.includes(`RESUMO-${marker}`), "O .md da nota baixa como os outros arquivos");

    // Membro desligado perde o acesso pela chave.
    await db.query("update console_memberships set active=false where company_id=$1 and email=$2", [ids.a, people.support.email]);
    ok((await send(token, note())).status === 403, "Membro desligado não salva mais pela chave");
    await db.query("update console_memberships set active=true where company_id=$1 and email=$2", [ids.a, people.support.email]);

    // A equipe vê o espaço da Anuntech.
    const adminToken = await connect("admin");
    r = await api("/api/reunioes/destinos", adminToken);
    const adminSpaces = r.status === 200 ? (await r.json()).spaces : [];
    ok(adminSpaces[0]?.id === "internal" && adminSpaces.some((space) => space.id === ids.b), "Equipe vê a Anuntech e todas as empresas");
    ok((await send(adminToken, note({ space: "internal", title: `Interna QA ${marker}` }))).status === 201, "Equipe salva nota no espaço da Anuntech");

    // Desconectar.
    r = await request("/configuracoes/seguranca", "support");
    ok(r.text.includes("Apps conectados") && r.text.includes(`Mac QA ${marker}`), "Segurança lista o Mac conectado");
    const connection = await one("select id from console_app_connections where token_hash=$1", [createHash("sha256").update(token).digest("hex")]);
    await submitForm("/configuracoes/seguranca", "outsider", "outsider", { action: "disconnectMeetingApp" }, { id: connection.id });
    ok((await api("/api/reunioes/destinos", token)).status === 200, "Outra conta não desconecta o app de alguém");
    await submitForm("/configuracoes/seguranca", "support", "support", { action: "disconnectMeetingApp" }, { id: connection.id });
    ok((await api("/api/reunioes/destinos", token)).status === 401, "Desconectado em Segurança, a chave deixa de valer");
    ok((await api("/api/reunioes/conexao", adminToken, { method: "DELETE" })).status === 204, "O app se desconecta sozinho");
    ok((await send(adminToken, note({ space: "internal" }))).status === 401, "Depois de desconectar pelo app, a chave deixa de valer");
    ok(
      (await db.query("select id from console_audit_events where action in ('app.connected','app.disconnected') and actor_id=any($1::text[])", [[people.support.id, people.admin.id]])).rowCount === 4,
      "Conectar e desconectar ficam na auditoria",
    );
  } finally {
    await db.query("delete from console_bookmarks where meeting->>'source'='reunioes' and author_id=any($1::text[])", [
      Object.values(people).map((person) => person.id),
    ]);
    await db.query("delete from console_bookmark_folders where id=$1", [folderB]);
    await db.query("delete from console_app_connections where user_id=any($1::text[])", [Object.values(people).map((person) => person.id)]);
  }
}
