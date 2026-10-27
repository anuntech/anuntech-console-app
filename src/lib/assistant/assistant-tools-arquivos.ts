import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { bookmarkFolderShares } from "@/db/schema";
import { db } from "../db";
import { bookmarkFor, foldersFor, scopeOf as bookmarkScope } from "../bookmarks/bookmarks";
import {
  createFolderAs,
  deleteBookmarkAs,
  deleteFolderAs,
  moveBookmarkAs,
  moveFolderAs,
  renameFolderAs,
  restoreBookmarkAs,
  shareFolderAs,
  updateBookmarkAs,
} from "../bookmarks/bookmark-core";
import { copyBookmarkAs } from "../bookmarks/bookmark-copy";
import { folderPath } from "../bookmarks/folder-tree";
import { createShareLinkAs } from "../drive/share-links";
import { TAG_SLUGS, tagLabels } from "../drive/tag-rules";
import { id, tool, ToolError, untrusted, type ToolContext } from "./assistant-tools-kit";

/*
 * Arquivos for the assistant, as complete as the page: the folder tree, and
 * every change (create inside a folder, move folders and items, rename, tag,
 * copy, trash and restore, delete a folder, share it, an external link).
 * Every change is a card the person confirms (write: true); each item goes
 * through the same rules as on the page, so what the person may not do, the
 * assistant may not either, and the result says which items stayed and why.
 */

const ids = (max: number) => z.array(id).min(1).max(max);
/** "" or absent: the top of the company (folders) or Sem pasta (items). */
const place = z.union([id, z.literal("")]).optional();

/** What happened to each of several items: how many went, and the first reasons of those that stayed. */
async function each<T>(list: T[], run: (one: T) => Promise<{ error?: string }>) {
  let done = 0;
  const refused: string[] = [];
  for (const one of list) {
    const state = await run(one);
    if (state.error) refused.push(state.error);
    else done++;
  }
  if (!done) throw new ToolError(refused[0] ?? "Nada mudou.");
  return { feitos: done, recusados: refused.length, motivos: [...new Set(refused)].slice(0, 3) };
}

/** A folder named `name` where the items go: created (in that company, or inside `parentId`) when none was given. */
async function destination(ctx: ToolContext, input: { destinoId?: string; novaPastaNome?: string; companyId?: string; dentroDeId?: string }) {
  if (input.destinoId !== undefined && input.destinoId !== "") return input.destinoId;
  if (!input.novaPastaNome) return "";
  const made = await createFolderAs(ctx.actor, { name: input.novaPastaNome, companyId: input.companyId ?? "", visibility: "company", parentId: input.dentroDeId ?? "" });
  if (made.error || !made.id) throw new ToolError(made.error ?? "Não foi possível criar a pasta.");
  return made.id;
}

const listFolders = tool({
  name: "listar_pastas",
  area: "bookmarks",
  description:
    "A árvore de pastas de Arquivos que a pessoa vê: id, nome, caminho (Marca › Logo), pasta de cima, empresa, quantos itens, quem vê, se a pessoa pode mudar a pasta e se é uma pasta do Console (contratos, entregas: não se move nem exclui). Use antes de mover, renomear ou organizar pastas.",
  input: z.object({ companyId: id.optional() }),
  run: async (ctx, { companyId }) => {
    const folders = await foldersFor(bookmarkScope(ctx.actor), companyId ?? "all");
    const tree = folders.map((f) => ({ id: f.id, parentId: f.parentId ?? null, companyId: f.companyId, name: f.name }));
    const name = (f: (typeof folders)[number]) => (f.companyId ? untrusted(ctx, f.companyId, `nome da pasta ${f.id}`, f.name) : f.name);
    return {
      result: folders.map((f) => ({
        pastaId: f.id,
        nome: name(f),
        caminho: folderPath(tree, f.id).map((p) => p.name).join(" › "),
        pastaDeCimaId: f.parentId ?? null,
        empresa: f.companyId ? f.company : "Anuntech",
        companyId: f.companyId,
        itens: f.count,
        quemVe: f.visibility === "company" ? "toda a empresa" : `só pessoas escolhidas (${f.sharedWith.length})`,
        podeMudar: ctx.actor.admin || (f.ownerId === ctx.actor.user.id && !f.system),
        doConsole: !!f.system,
        soVerEBaixar: f.adds === "owner",
      })),
      summary: "Consultei as pastas",
    };
  },
});

const moveFolders = tool({
  name: "mover_pastas",
  area: "bookmarks",
  description:
    "Move pastas (com tudo o que têm dentro) para dentro de outra pasta da mesma empresa (destinoId) ou para o início (destinoId vazio). Para juntar várias numa pasta nova, passe novaPastaNome (e companyId, ou dentroDeId para criá-la dentro de outra) em vez de destinoId: a pasta é criada e recebe as outras. Pastas do Console e pastas com acesso restrito seguem as regras da tela.",
  input: z.object({ pastaIds: ids(50), destinoId: place, novaPastaNome: z.string().trim().min(1).max(80).optional(), companyId: id.optional(), dentroDeId: id.optional() }),
  write: true,
  run: async (ctx, input) => {
    const target = await destination(ctx, input);
    const outcome = await each(input.pastaIds.filter((f) => f !== target), (folderId) => moveFolderAs(ctx.actor, { id: folderId, parentId: target }));
    return {
      result: { ...outcome, destino: target ? `/bookmarks?pasta=${target}` : "início", link: target ? `/bookmarks?pasta=${target}` : "/bookmarks" },
      summary: `Movi ${outcome.feitos === 1 ? "1 pasta" : `${outcome.feitos} pastas`}`,
      actions: [{ type: "refresh" }],
    };
  },
});

const moveItems = tool({
  name: "mover_itens",
  area: "bookmarks",
  description:
    "Move itens de Arquivos (arquivos, links, lousas; ids de listar_bookmarks) para uma pasta (pastaId) ou para Sem pasta (pastaId vazio). Com novaPastaNome (e companyId ou dentroDeId) cria a pasta e move para ela.",
  input: z.object({ itemIds: ids(200), pastaId: place, novaPastaNome: z.string().trim().min(1).max(80).optional(), companyId: id.optional(), dentroDeId: id.optional() }),
  write: true,
  run: async (ctx, input) => {
    const target = await destination(ctx, { ...input, destinoId: input.pastaId });
    const outcome = await each(input.itemIds, (itemId) => moveBookmarkAs(ctx.actor, { id: itemId, folderId: target }));
    return { result: { ...outcome, link: target ? `/bookmarks?pasta=${target}` : "/bookmarks?pasta=root" }, summary: `Movi ${outcome.feitos === 1 ? "1 item" : `${outcome.feitos} itens`}`, actions: [{ type: "refresh" }] };
  },
});

const renameFolder = tool({
  name: "renomear_pasta",
  area: "bookmarks",
  description: "Muda o nome de uma pasta (quem a criou ou a equipe).",
  input: z.object({ pastaId: id, nome: z.string().trim().min(1).max(80) }),
  write: true,
  run: async (ctx, input) => {
    const state = await renameFolderAs(ctx.actor, { id: input.pastaId, name: input.nome });
    if (state.error) throw new ToolError(state.error);
    return { result: { renomeada: true, link: `/bookmarks?pasta=${input.pastaId}` }, summary: `Renomeei a pasta para "${input.nome}"`, actions: [{ type: "refresh" }] };
  },
});

/** An item as it is, for a change that keeps the rest (rename, tag). */
async function editable(ctx: ToolContext, itemId: string) {
  const item = await bookmarkFor(ctx.actor, itemId);
  if (!item) throw new ToolError("Item não encontrado, ou você não tem acesso a ele.");
  return item;
}

const renameItem = tool({
  name: "renomear_item",
  area: "bookmarks",
  description: "Muda o nome (título) de um item de Arquivos; o arquivo, o link e a pasta ficam como estão.",
  input: z.object({ bookmarkId: id, nome: z.string().trim().min(1).max(160) }),
  write: true,
  run: async (ctx, input) => {
    const item = await editable(ctx, input.bookmarkId);
    const state = await updateBookmarkAs(ctx.actor, { id: item.id, title: input.nome, url: item.url ?? "", folderId: item.folderId ?? "" });
    if (state.error) throw new ToolError(state.error);
    return { result: { renomeado: true }, summary: `Renomeei para "${input.nome}"`, actions: [{ type: "refresh" }] };
  },
});

const tagItems = tool({
  name: "etiquetar_itens",
  area: "bookmarks",
  description: `Põe a mesma etiqueta em itens de Arquivos (a escolha da pessoa, que o Console não troca), ou tira com "nenhuma". Etiquetas: ${TAG_SLUGS.join(", ")}.`,
  input: z.object({ itemIds: ids(200), etiqueta: z.enum([...TAG_SLUGS, "nenhuma"]) }),
  write: true,
  run: async (ctx, input) => {
    const outcome = await each(input.itemIds, async (itemId) => {
      const item = await bookmarkFor(ctx.actor, itemId);
      if (!item) return { error: "Item não encontrado." };
      return updateBookmarkAs(ctx.actor, { id: item.id, title: item.title, url: item.url ?? "", folderId: item.folderId ?? "", tag: input.etiqueta === "nenhuma" ? "" : input.etiqueta });
    });
    const label = input.etiqueta === "nenhuma" ? "sem etiqueta" : tagLabels[input.etiqueta];
    return { result: outcome, summary: `Deixei ${outcome.feitos === 1 ? "1 item" : `${outcome.feitos} itens`} como ${label}`, actions: [{ type: "refresh" }] };
  },
});

const copyItem = tool({
  name: "copiar_item",
  area: "bookmarks",
  description: "Faz uma cópia de um item de Arquivos numa pasta (pastaId) ou em Sem pasta da mesma empresa (pastaId vazio). Um arquivo copiado ocupa o espaço da empresa de destino.",
  input: z.object({ bookmarkId: id, pastaId: place }),
  write: true,
  run: async (ctx, input) => {
    const state = await copyBookmarkAs(ctx.actor, { id: input.bookmarkId, folderId: input.pastaId ?? "" });
    if (state.error) throw new ToolError(state.error);
    return { result: { copiado: true, mensagem: state.success }, summary: "Fiz a cópia", actions: [{ type: "refresh" }] };
  },
});

const trashItems = tool({
  name: "mandar_para_lixeira",
  area: "bookmarks",
  description: "Manda itens de Arquivos para a lixeira, onde ficam 30 dias e podem ser restaurados (restaurar_itens).",
  input: z.object({ itemIds: ids(200) }),
  write: true,
  run: async (ctx, input) => {
    const outcome = await each(input.itemIds, (itemId) => deleteBookmarkAs(ctx.actor, { id: itemId }));
    return { result: outcome, summary: `Mandei ${outcome.feitos === 1 ? "1 item" : `${outcome.feitos} itens`} para a lixeira`, actions: [{ type: "refresh" }] };
  },
});

const restoreItems = tool({
  name: "restaurar_itens",
  area: "bookmarks",
  description: "Traz de volta da lixeira itens de Arquivos, para a pasta onde estavam (ids de listar_bookmarks com pastaId \"lixeira\").",
  input: z.object({ itemIds: ids(200) }),
  write: true,
  run: async (ctx, input) => {
    const outcome = await each(input.itemIds, (itemId) => restoreBookmarkAs(ctx.actor, { id: itemId }));
    return { result: outcome, summary: `Restaurei ${outcome.feitos === 1 ? "1 item" : `${outcome.feitos} itens`}`, actions: [{ type: "refresh" }] };
  },
});

const deleteFolder = tool({
  name: "excluir_pasta",
  area: "bookmarks",
  description: "Exclui uma pasta; o que está dentro (itens e subpastas) sobe para a pasta de cima, nada é apagado. Pastas do Console não são excluídas.",
  input: z.object({ pastaId: id }),
  write: true,
  run: async (ctx, input) => {
    const state = await deleteFolderAs(ctx.actor, { id: input.pastaId });
    if (state.error) throw new ToolError(state.error);
    return { result: { excluida: true }, summary: "Excluí a pasta", actions: [{ type: "refresh" }] };
  },
});

const shareFolder = tool({
  name: "compartilhar_pasta",
  area: "bookmarks",
  description:
    "Muda quem vê uma pasta (toda a empresa, ou só as pessoas já escolhidas nela) e o que pode fazer (ver, baixar e adicionar, ou só ver e baixar). Para escolher pessoas novas, a pessoa usa Compartilhar na tela.",
  input: z.object({ pastaId: id, quemVe: z.enum(["company", "people"]), quemVePode: z.enum(["viewers", "owner"]).optional() }),
  write: true,
  run: async (ctx, input) => {
    // "Só pessoas escolhidas" keeps the people the folder already has.
    const people = (await db.select({ userId: bookmarkFolderShares.userId }).from(bookmarkFolderShares).where(eq(bookmarkFolderShares.folderId, input.pastaId))).map((r) => r.userId);
    const state = await shareFolderAs(ctx.actor, { id: input.pastaId, visibility: input.quemVe, userIds: input.quemVe === "people" ? people : [], adds: input.quemVePode });
    if (state.error) throw new ToolError(state.error);
    return { result: { mensagem: state.success }, summary: "Mudei o compartilhamento da pasta", actions: [{ type: "refresh" }] };
  },
});

const externalLink = tool({
  name: "criar_link_externo",
  area: "bookmarks",
  description:
    "Cria um link que abre sem conta: para baixar um arquivo (bookmarkId) ou uma pasta (pastaId), ou, com tipo \"pedido\", para receber arquivos numa pasta. Valem por validadeDias (1 a 365; vazio, sem prazo), com senha e limite de downloads opcionais. O endereço aparece uma vez: entregue à pessoa na resposta.",
  input: z.object({
    tipo: z.enum(["download", "pedido"]).default("download"),
    bookmarkId: id.optional(),
    pastaId: id.optional(),
    validadeDias: z.number().int().min(1).max(365).optional(),
    senha: z.string().min(6).max(100).optional(),
    limiteDownloads: z.number().int().min(1).max(10_000).optional(),
  }),
  write: true,
  run: async (ctx, input) => {
    if (!input.bookmarkId && !input.pastaId) throw new ToolError("Diga qual arquivo ou pasta.");
    const result = await createShareLinkAs(ctx.actor, {
      kind: input.tipo === "pedido" ? "request" : "download",
      bookmarkId: input.tipo === "pedido" ? "" : (input.bookmarkId ?? ""),
      folderId: input.pastaId ?? "",
      expiresInDays: input.validadeDias ? String(input.validadeDias) : "",
      password: input.senha ?? "",
      maxDownloads: input.limiteDownloads ? String(input.limiteDownloads) : "",
      email: "",
    });
    if (result.error || !result.url) throw new ToolError(result.error ?? "Não foi possível criar o link.");
    return { result: { endereco: result.url, aviso: "O endereço aparece só agora: copie e envie." }, summary: "Criei o link externo" };
  },
});

/** The names the confirmation card shows for folders and items, read with the person's access (an id they cannot see refuses the card). */
export async function arquivosNames(ctx: Pick<ToolContext, "actor">, args: Record<string, unknown>) {
  const names: Record<string, string> = {};
  const strings = (value: unknown) => (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === "string" && v !== "");
  const folderIds = [...strings(args.pastaId), ...strings(args.pastaIds), ...strings(args.destinoId), ...strings(args.dentroDeId)];
  if (folderIds.length) {
    const visible = await foldersFor(bookmarkScope(ctx.actor), "all");
    for (const folderId of folderIds) {
      const folder = visible.find((f) => f.id === folderId);
      if (!folder) throw new ToolError("Pasta não encontrada. Use um id devolvido por listar_pastas.");
      names[folderId] = folder.company ? `${folder.name} · ${folder.company}` : folder.name;
    }
  }
  const itemIds = [...strings(args.bookmarkId), ...strings(args.itemIds)];
  if (itemIds.length) {
    const found = await Promise.all(itemIds.map((itemId) => bookmarkFor(ctx.actor, itemId)));
    // Items in the trash are named too (restaurar_itens).
    const trashed = await Promise.all(itemIds.map((itemId, i) => (found[i] ? null : bookmarkFor(ctx.actor, itemId, { trashed: true }))));
    itemIds.forEach((itemId, i) => {
      const item = found[i] ?? trashed[i];
      if (!item) throw new ToolError("Item não encontrado. Use um id devolvido por listar_bookmarks.");
      names[itemId] = item.title;
    });
  }
  return names;
}

export const arquivosTools = [listFolders, moveFolders, moveItems, renameFolder, renameItem, tagItems, copyItem, trashItems, restoreItems, deleteFolder, shareFolder, externalLink];
