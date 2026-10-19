import { createHmac, randomUUID } from "node:crypto";
import sharp from "sharp";

/**
 * Ícones do catálogo: a equipe envia, gera com IA (mock do AI Gateway), escolhe
 * da galeria e remove; quem vê um produto feito do item carrega o ícone, quem
 * não vê recebe 404. O Blob roda em memória no servidor de teste
 * (scripts/blob-mock.cjs), nunca num armazenamento real.
 */
export async function runCatalogIconTests({ database: db, ids, people, request, submitForm, ok, marker, base }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const itemId = randomUUID();
  const engagementId = randomUUID();
  const created = [itemId];
  const endpoint = `/api/catalogo/${itemId}/icone`;
  const write = (who, method, init = {}, origin = base) =>
    request(endpoint, who, { method, ...init, headers: { Origin: origin, ...init.headers } });
  const upload = (who, body, type = "image/png", extra = {}) =>
    write(who, "POST", { body, headers: { "Content-Type": type, ...extra } });
  const pick = (who, icon) =>
    write(who, "PATCH", { body: JSON.stringify({ icon }), headers: { "Content-Type": "application/json" } });
  const generate = (who, hint, origin = base) =>
    request(`${endpoint}/gerar`, who, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ hint }),
    });
  const current = async () => (await one("select icon from console_catalog_items where id=$1", [itemId]))?.icon ?? null;
  const lastSource = async () =>
    (await one("select details from console_audit_events where entity_id=$1 and action='catalog.icon_changed' order by created_at desc limit 1", [itemId]))
      ?.details?.source;
  /** The served file as bytes (request() reads text). */
  const image = async (path, who) => {
    const response = await fetch(base + path, { headers: who ? { Cookie: people[who].cookie } : {} });
    return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
  };

  try {
    await db.query("insert into console_catalog_items(id,kind,name,description) values($1,'product',$2,$3)", [
      itemId,
      `Ícone QA ${marker}`,
      "Produto de teste dos ícones.",
    ]);
    await db.query("insert into console_engagements(id,company_id,name,kind,catalog_item_id) values($1,$2,$3,'product',$4)", [
      engagementId,
      ids.a,
      `Ícone QA ${marker}`,
      itemId,
    ]);

    // A wide logo with a transparent background: the icon keeps it whole, on white.
    const logo = await sharp({ create: { width: 600, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp({ create: { width: 200, height: 120, channels: 3, background: "#1a428a" } }).png().toBuffer(), left: 200, top: 40 }])
      .png()
      .toBuffer();

    // Only the team changes icons; anyone else gets 404, as if the route did not exist.
    for (const who of ["manager", "support", "outsider"]) {
      ok((await upload(who, logo)).status === 404, `${who} não envia ícone`);
      ok((await pick(who, "/brand/catalog-icons/email.webp")).status === 404, `${who} não escolhe ícone da galeria`);
      ok((await write(who, "DELETE")).status === 404, `${who} não remove ícone`);
      ok((await generate(who, "")).status === 404, `${who} não gera ícone com IA`);
    }
    ok((await upload(null, logo)).status === 404, "Sem sessão, o envio de ícone é recusado");
    ok((await write("admin", "POST", { body: logo, headers: { "Content-Type": "image/png" } }, "https://evil.invalid")).status === 403, "Envio de ícone de outra origem é recusado");
    ok((await current()) === null, "Pedidos recusados não mudam o ícone");

    // What the upload accepts.
    ok((await upload("admin", Buffer.from('<svg onload="alert(1)"/>'), "image/svg+xml")).status === 415, "SVG não vira ícone");
    ok((await upload("admin", logo, "image/jpeg")).status === 422, "Imagem com tipo trocado é recusada");
    ok((await upload("admin", Buffer.alloc(2 * 1024 * 1024 + 1), "image/png")).status === 413, "Imagem acima de 2 MB é recusada");
    ok((await request(`/api/catalogo/${randomUUID()}/icone`, "admin", { method: "POST", body: logo, headers: { Origin: base, "Content-Type": "image/png" } })).status === 404, "Item inexistente não recebe ícone");

    // The team uploads: a private file per change, served with its version in the URL.
    const sent = await upload("admin", logo);
    const saved = JSON.parse(sent.text);
    const stored = await current();
    ok(
      sent.status === 200 &&
        new RegExp(`^catalog-icons/${itemId}/[0-9a-f-]{36}\\.webp$`).test(stored ?? "") &&
        saved.icon === stored &&
        saved.src === `${endpoint}?v=${stored.split("/")[2].replace(".webp", "")}`,
      "A equipe envia o ícone e o item guarda o arquivo privado",
    );
    ok((await lastSource()) === "upload", "A troca de ícone fica no histórico como envio");
    const served = await image(saved.src, "admin");
    const meta = served.status === 200 ? await sharp(served.bytes).metadata() : {};
    const corner = served.status === 200 ? (await sharp(served.bytes).raw().toBuffer()).subarray(0, 3) : Buffer.alloc(3);
    ok(
      served.status === 200 &&
        served.headers.get("content-type") === "image/webp" &&
        /private/.test(served.headers.get("cache-control") ?? "") &&
        /max-age=31536000/.test(served.headers.get("cache-control") ?? "") &&
        /immutable/.test(served.headers.get("cache-control") ?? ""),
      "O ícone enviado é servido em WebP com cache privado e imutável",
    );
    ok(meta.width === 256 && meta.height === 256 && !meta.hasAlpha && [...corner].every((v) => v > 245), "O logo largo vira um ícone de 256 px opaco, com fundo branco");

    // Who loads it: whoever sees a product made from the item.
    ok((await image(saved.src, "manager")).status === 200, "Administrador da empresa com o produto carrega o ícone");
    ok((await image(saved.src, "support")).status === 200, "Membro que vê todos os produtos carrega o ícone");
    ok((await image(saved.src, "outsider")).status === 404, "Quem não vê o produto recebe 404");
    ok((await image(saved.src)).status === 401, "Sem sessão, o ícone pede login");
    ok((await image(`${endpoint}?v=${randomUUID()}`, "admin")).status === 404, "Versão diferente da atual não é servida");
    ok((await image(endpoint, "admin")).status === 404, "Sem a versão, o ícone não é servido");
    await db.query("update console_memberships set engagement_access='selected' where company_id=$1 and email=$2", [ids.a, people.support.email]);
    try {
      ok((await image(saved.src, "support")).status === 404, "Membro sem o produto na seleção não carrega o ícone");
    } finally {
      await db.query("update console_memberships set engagement_access='all' where company_id=$1 and email=$2", [ids.a, people.support.email]);
    }
    const settings = await request("/configuracoes/catalogo", "admin");
    ok(settings.status === 200 && settings.text.includes(saved.src), "O catálogo mostra o ícone enviado na lista");

    // AI options: four 256 px WebP previews, nothing stored until one is picked.
    const options = await generate("admin", "");
    const generated = JSON.parse(options.text).options ?? [];
    const first = generated[0] ? await sharp(Buffer.from(generated[0].split(",")[1], "base64")).metadata() : {};
    ok(
      options.status === 200 &&
        generated.length === 4 &&
        generated.every((option) => option.startsWith("data:image/webp;base64,")) &&
        first.width === 256 &&
        first.height === 256 &&
        /no-store/.test(options.headers.get("cache-control") ?? ""),
      "Gerar com IA devolve 4 opções em WebP de 256 px, sem cache",
    );
    ok((await current()) === stored, "Gerar opções não muda o ícone do item");
    const singles = JSON.parse((await generate("admin", "UM-POR-VEZ")).text).options ?? [];
    ok(singles.length === 4, "Modelo que só gera uma imagem por vez ainda rende 4 opções");
    ok((await generate("admin", "x".repeat(201))).status === 400, "A descrição do ícone tem até 200 caracteres");
    const failed = await generate("admin", "FALHA-ICONE");
    ok(failed.status === 502 && JSON.parse(failed.text).error === "Não foi possível gerar agora. Tente de novo ou envie uma imagem.", "Falha dos modelos de imagem vira mensagem clara");
    const key = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(`catalog-icon:${people.admin.id}`).digest("hex");
    await db.query("update console_otp_limits set count=20, window_start=now() where key=$1", [key]);
    ok((await generate("admin", "")).status === 429, "Gerar ícones tem limite por hora");
    await db.query("delete from console_otp_limits where key=$1", [key]);

    // The picked option goes back as bytes, through the upload path.
    const chosen = await upload("admin", Buffer.from(generated[0].split(",")[1], "base64"), "image/webp", { "x-icon-source": "ai" });
    const fromAi = await current();
    ok(chosen.status === 200 && fromAi !== stored && JSON.parse(chosen.text).icon === fromAi, "A opção escolhida vira o ícone do item");
    ok((await lastSource()) === "ai", "A troca fica no histórico como gerada com IA");
    ok((await image(saved.src, "admin")).status === 404, "O endereço do ícone anterior deixa de servir");

    // The gallery: bundled files only, never a URL or someone else's file.
    for (const value of [
      "https://evil.invalid/x.png",
      "/brand/catalog-icons/../avatars/avatar-01.svg",
      "/brand/catalog-icons/nao-existe.webp",
      fromAi,
      `catalog-icons/${randomUUID()}/${randomUUID()}.webp`,
      null,
    ])
      ok((await pick("admin", value)).status === 400, `Galeria recusa ${String(value).slice(0, 40)}`);
    ok((await current()) === fromAi, "Valores fora da galeria não mudam o ícone");
    const galleryPick = await pick("admin", "/brand/catalog-icons/email.webp");
    ok(galleryPick.status === 200 && (await current()) === "/brand/catalog-icons/email.webp" && JSON.parse(galleryPick.text).src === "/brand/catalog-icons/email.webp", "A equipe escolhe um ícone da galeria");
    ok((await lastSource()) === "gallery", "A troca fica no histórico como galeria");
    ok((await image(`${endpoint}?v=${fromAi.split("/")[2].replace(".webp", "")}`, "admin")).status === 404, "Com ícone da galeria, a rota não serve arquivo guardado");
    ok((await request("/brand/catalog-icons/email.webp")).status === 200, "O ícone da galeria é um arquivo estático");

    const removed = await write("admin", "DELETE");
    ok(removed.status === 200 && JSON.parse(removed.text).icon === null && (await current()) === null, "A equipe remove o ícone");
    ok((await lastSource()) === "removed", "A remoção fica no histórico");

    // New items: a gallery icon from the form, or the one that fits the name; never a stored file.
    const save = (values) =>
      submitForm("/configuracoes/catalogo", "admin", "admin", { action: "saveCatalogItem" }, {
        kind: "product",
        description: "",
        url: "",
        defaultAmount: "",
        interval: "",
        icon: "",
        ...values,
      });
    const byName = async (name) => one("select id, icon from console_catalog_items where name=$1", [name]);
    const suggested = `Servidor de e-mail QA ${marker}`;
    await save({ name: suggested });
    const suggestedRow = await byName(suggested);
    if (suggestedRow) created.push(suggestedRow.id);
    ok(suggestedRow?.icon === "/brand/catalog-icons/email.webp", "Item novo sem ícone recebe o da galeria que combina com o nome");
    const staged = `Item com galeria ${marker}`;
    await save({ name: staged, icon: "/brand/catalog-icons/site.webp" });
    const stagedRow = await byName(staged);
    if (stagedRow) created.push(stagedRow.id);
    ok(stagedRow?.icon === "/brand/catalog-icons/site.webp", "Item novo guarda o ícone escolhido na galeria");
    const forged = `Item forjado ${marker}`;
    await save({ name: forged, icon: `catalog-icons/${itemId}/${randomUUID()}.webp` });
    const forgedRow = await byName(forged);
    if (forgedRow) created.push(forgedRow.id);
    ok(!forgedRow, "Item novo não aceita ícone fora da galeria");
    await save({ id: stagedRow?.id ?? "", name: staged, icon: "/brand/catalog-icons/app.webp" });
    ok((await byName(staged))?.icon === "/brand/catalog-icons/site.webp", "Editar o item não troca o ícone pelo formulário");
  } finally {
    await db.query("delete from console_engagements where id=$1", [engagementId]);
    await db.query("delete from console_audit_events where entity_id=any($1::text[])", [created]);
    await db.query("delete from console_catalog_items where id=any($1::text[])", [created]);
  }
}
