"use server";
import { createHash } from "node:crypto";
import { and, asc, count, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { getActor, canAccess, type Actor } from "../access/access";
import { auth } from "../auth/auth";
import {
  accountEmails,
  auditEvents,
  catalogItems,
  companies,
  contractChangeRequests,
  contractSignatures,
  contractTemplates,
  contractVersions,
  contracts,
  engagements,
  environmentProfile,
  memberships,
  quotes,
  subscriptions,
  user,
  type ContractPublication,
} from "@/db/schema";
import type { ActionState } from "../action-state";
import { addressLabel } from "../companies/company-billing";
import { formatDocument } from "../companies/company-input";
import { contractPdf } from "./contract-pdf";
import { deliverContractNotice } from "./contract-mail";
import { sendOpsMail } from "../notifications/ops-alerts";
import { inviteManagerOnSend } from "../access/invite-manager";
import { deliverContractSigned } from "../automations/client-automations";
import { after } from "next/server";
import { fillContractTemplate, pendingContractVariables } from "./contract-templates";
import { applyContractFields, contractFields } from "./contract-fields";
import { quoteContractValues } from "../quotes/quote-handoff";
import { currency, longDateLabel } from "../format";
import { hasPermission } from "../access/permissions";

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para fazer isso." };
const bodyText = z
  .string()
  .transform((v) => v.replace(/\r\n?/g, "\n"))
  .pipe(
    z
      .string()
      .trim()
      .min(1, "Escreva o contrato.")
      .max(100000, "O contrato pode ter até 100 mil caracteres.")
      .regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f]*$/, "Remova os caracteres de controle do texto."),
  );
const civilDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")]).default("");
/** Start and end of validity; both optional, but never reversed. */
const term = z
  .object({ startsAt: civilDate, endsAt: civilDate })
  .refine((t) => !t.startsAt || !t.endsAt || t.startsAt <= t.endsAt, {
    message: "O fim da vigência precisa vir depois do início.",
    path: ["endsAt"],
  });
const failure = (e: unknown): ActionState => ({
  error:
    e instanceof z.ZodError
      ? e.issues[0].message
      : e instanceof Error && e.message === "stale"
        ? "O contrato mudou em outra aba. Atualize a página antes de continuar."
        : e instanceof Error && e.message
          ? e.message
          : "Não foi possível salvar o contrato. Confira os dados e tente novamente.",
});
function refresh(contractId?: string, parentId?: string | null) {
  revalidatePath("/contratos");
  revalidatePath("/configuracoes/contratos");
  if (contractId) revalidatePath(`/contratos/${contractId}`);
  if (parentId) revalidatePath(`/contratos/${parentId}`);
}
/**
 * SHA-256 of the frozen text. Keys are sorted first: JSONB gives them back
 * in its own order, so the hash must not depend on insertion order.
 */
const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
        )
      : value;
const hashOf = (publication: ContractPublication) => sha256(canonical(publication));
/** Contracts sent before the canonical hash were hashed in insertion order. */
const LEGACY_ORDERS: (keyof ContractPublication)[][] = [
  ["title", "body", "companyName", "companyDocument", "kind", "parentTitle", "parentHash", "startsAt", "endsAt"],
  ["title", "body", "companyName", "companyDocument"],
];
function hashMatches(publication: ContractPublication, documentHash: string) {
  if (hashOf(publication) === documentHash) return true;
  return LEGACY_ORDERS.some((order) => {
    const ordered: Record<string, unknown> = {};
    for (const key of order) if (key in publication) ordered[key] = publication[key];
    return Object.keys(ordered).length === Object.keys(publication).length && sha256(ordered) === documentHash;
  });
}

/* ---------- templates (staff) ---------- */

export async function saveContractTemplate(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        id: z.union([id, z.literal("")]).default(""),
        name: z.string().trim().min(1, "Dê um nome ao modelo.").max(160),
        description: z.string().trim().max(500).default(""),
        body: bodyText,
      })
      .parse(Object.fromEntries(form));
    const values = {
      name: input.name,
      description: input.description || null,
      body: input.body,
      updatedAt: new Date(),
    };
    const templateId = input.id
      ? (
          await db
            .update(contractTemplates)
            .set(values)
            .where(eq(contractTemplates.id, input.id))
            .returning({ id: contractTemplates.id })
        )[0]?.id
      : (await db.insert(contractTemplates).values(values).returning({ id: contractTemplates.id }))[0].id;
    if (!templateId) return blocked;
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      action: input.id ? "contract_template.updated" : "contract_template.created",
      entityId: templateId,
      details: { name: input.name },
    });
    refresh();
    return { success: input.id ? "Modelo atualizado." : "Modelo criado." };
  } catch (e) {
    return failure(e);
  }
}

export async function toggleContractTemplate(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const templateId = id.parse(form.get("id"));
    const [row] = await db
      .select({ active: contractTemplates.active })
      .from(contractTemplates)
      .where(eq(contractTemplates.id, templateId));
    if (!row) return blocked;
    await db
      .update(contractTemplates)
      .set({ active: !row.active, updatedAt: new Date() })
      .where(eq(contractTemplates.id, templateId));
    refresh();
    return { success: row.active ? "Modelo desativado." : "Modelo reativado." };
  } catch (e) {
    return failure(e);
  }
}

/* ---------- contracts ---------- */

/** What fills the template for one company (and, when chosen, one item). */
async function contractValues(
  companyId: string,
  engagementId: string | null,
  extra: { startsAt: string; endsAt: string; parent: { title: string; signedAt: Date | null } | null },
) {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) throw new Error("Empresa não encontrada.");
  const [anuntech] = await db.select().from(environmentProfile).limit(1);
  const linked = engagementId
    ? (
        await db
          .select({
            name: engagements.name,
            amountCents: engagements.amountCents,
            interval: subscriptions.interval,
            catalogInterval: catalogItems.interval,
          })
          .from(engagements)
          .leftJoin(subscriptions, eq(subscriptions.id, engagements.subscriptionId))
          .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
          .where(and(eq(engagements.id, engagementId), eq(engagements.companyId, companyId)))
      )[0]
    : null;
  if (engagementId && !linked) throw new Error("O vínculo escolhido não é desta empresa.");
  const interval = linked?.interval ?? linked?.catalogInterval ?? null;
  return {
    company,
    values: {
      empresa: company.name,
      cnpj: formatDocument(company.document),
      endereco: company.billingAddress ? addressLabel(company.billingAddress) : "",
      produto: linked?.name ?? "",
      valor: linked?.amountCents != null ? currency(linked.amountCents) : "",
      ciclo: interval === "yearly" ? "anual" : interval === "monthly" ? "mensal" : "",
      inicio: extra.startsAt ? longDateLabel(extra.startsAt) : "",
      fim: extra.endsAt ? longDateLabel(extra.endsAt) : "",
      data: longDateLabel(new Date()),
      contrato: extra.parent?.title ?? "",
      contrato_data: extra.parent?.signedAt ? longDateLabel(extra.parent.signedAt) : "",
      anuntech: anuntech?.name ?? "",
      anuntech_cnpj: anuntech ? formatDocument(anuntech.document) : "",
      anuntech_endereco: anuntech?.billingAddress ? addressLabel(anuntech.billingAddress) : "",
    },
  };
}

const AMENDMENT_SKELETON = [
  "TERMO ADITIVO AO CONTRATO",
  "CONTRATANTE: {{empresa}}, CNPJ {{cnpj}}.\nCONTRATADA: {{anuntech}}, CNPJ {{anuntech_cnpj}}.",
  "As partes acima resolvem aditar o contrato “{{contrato}}”, assinado em {{contrato_data}}, nos seguintes termos:",
  "CLÁUSULA 1 — OBJETO DO ADITIVO\n",
  "CLÁUSULA 2 — RATIFICAÇÃO\nPermanecem inalteradas as demais cláusulas e condições do contrato original.",
  "São Paulo, {{data}}.",
].join("\n\n");

/** An amendment that only extends the term; the team reviews the text before sending. */
const RENEWAL_SKELETON = [
  "TERMO ADITIVO DE PRORROGAÇÃO",
  "CONTRATANTE: {{empresa}}, CNPJ {{cnpj}}.\nCONTRATADA: {{anuntech}}, CNPJ {{anuntech_cnpj}}.",
  "As partes acima resolvem aditar o contrato “{{contrato}}”, assinado em {{contrato_data}}, nos seguintes termos:",
  "CLÁUSULA 1 — PRORROGAÇÃO\nA vigência do contrato fica prorrogada para o período de {{inicio}} a {{fim}}.",
  "CLÁUSULA 2 — RATIFICAÇÃO\nPermanecem inalteradas as demais cláusulas e condições do contrato original.",
  "São Paulo, {{data}}.",
].join("\n\n");

/**
 * A draft from a template (or blank), with the company's data filled in.
 * With `parentId`, it is an amendment to a signed contract of the same company.
 */
export async function createContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        companyId: z.union([id, z.literal("")]).default(""),
        parentId: z.union([id, z.literal("")]).default(""),
        templateId: z.union([id, z.literal("")]).default(""),
        engagementId: z.union([id, z.literal("")]).default(""),
        title: z.string().trim().max(160).default(""),
        quoteId: z.union([id, z.literal("")]).default(""),
        renewal: z.literal("yes").optional(),
      })
      .and(term)
      .parse(Object.fromEntries(form));
    const parent = input.parentId
      ? (await db.select().from(contracts).where(eq(contracts.id, input.parentId)))[0]
      : null;
    if (input.parentId && !parent) return { error: "Contrato original não encontrado." };
    if (parent && parent.status !== "signed") return { error: "Só contratos assinados recebem aditivos." };
    if (parent && parent.kind !== "contract") return { error: "Um aditivo não pode receber outro aditivo; adite o contrato original." };
    if (parent && input.renewal) {
      const [pending] = await db
        .select({ id: contracts.id })
        .from(contracts)
        .where(and(eq(contracts.parentId, parent.id), inArray(contracts.status, ["draft", "sent", "in_review"])));
      if (pending) return { error: "Já existe um aditivo em andamento para este contrato. Abra o que existe antes de preparar outra prorrogação." };
    }
    const companyId = parent?.companyId ?? input.companyId;
    if (!companyId) return { error: "Escolha a empresa." };
    const template = input.templateId
      ? (
          await db
            .select()
            .from(contractTemplates)
            .where(and(eq(contractTemplates.id, input.templateId), eq(contractTemplates.active, true)))
        )[0]
      : null;
    if (input.templateId && !template) return { error: "Escolha um modelo ativo." };
    // The accepted proposal this contract formalizes, once: a second one would split what was agreed.
    const quote =
      !parent && input.quoteId
        ? (await db.select().from(quotes).where(and(eq(quotes.id, input.quoteId), eq(quotes.companyId, companyId), eq(quotes.status, "accepted"))))[0]
        : null;
    if (input.quoteId && !parent && !quote) return { error: "O orçamento precisa estar aceito e ser desta empresa." };
    if (quote) {
      const [existing] = await db
        .select({ id: contracts.id })
        .from(contracts)
        .where(and(eq(contracts.quoteId, quote.id), ne(contracts.status, "cancelled")));
      if (existing) return { error: "Este orçamento já tem um contrato. Abra o que existe pelo orçamento." };
    }
    const engagementId = input.engagementId || parent?.engagementId || null;
    const { company, values } = await contractValues(companyId, engagementId, {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      parent: parent ? { title: parent.title, signedAt: parent.signedAt } : null,
    });
    const amendmentNumber = parent
      ? (
          await db
            .select({ n: count() })
            .from(contracts)
            .where(and(eq(contracts.parentId, parent.id), ne(contracts.status, "cancelled")))
        )[0].n + 1
      : 0;
    const title =
      input.title ||
      (parent
        ? `Aditivo ${amendmentNumber} — ${parent.title}`
        : template
          ? `${template.name} — ${company.name}`
          : `Contrato — ${company.name}`);
    let body = template
      ? fillContractTemplate(template.body, values)
      : parent
        ? fillContractTemplate(input.renewal ? RENEWAL_SKELETON : AMENDMENT_SKELETON, values)
        : "";
    if (quote && body) {
      const accepted = quote.publication ?? { ...quote.content, title: quote.title };
      body = applyContractFields(
        body,
        quoteContractValues({ ...quote, title: accepted.title, content: accepted }, contractFields(body).map((f) => f.key)),
      ).body;
    }
    const [row] = await db
      .insert(contracts)
      .values({
        companyId: company.id,
        templateId: template?.id ?? null,
        engagementId,
        kind: parent ? "amendment" : "contract",
        parentId: parent?.id ?? null,
        title,
        body: body || "Escreva o contrato.",
        startsAt: input.startsAt || null,
        endsAt: input.endsAt || null,
        authorId: actor.user.id,
        quoteId: quote?.id ?? null,
      })
      .returning({ id: contracts.id });
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: company.id,
      entityId: row.id,
      action: parent ? "contract.amendment_created" : "contract.created",
      details: { templateId: template?.id ?? null, parentId: parent?.id ?? null, quoteId: quote?.id ?? null, renewal: !!input.renewal },
    });
    if (parent)
      await db.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: company.id,
        entityId: parent.id,
        action: "contract.amendment_created",
        details: { amendmentId: row.id },
      });
    refresh(row.id, parent?.id);
    return {
      success: parent
        ? "Rascunho do aditivo criado. Revise o texto e envie para assinatura."
        : "Rascunho criado. Revise o texto e envie para assinatura.",
      href: `/contratos/${row.id}`,
    };
  } catch (e) {
    return failure(e);
  }
}

/** Title, text and validity of a draft; the revision guards against edits in another tab. */
export async function saveContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        id,
        revision: z.coerce.number().int().positive(),
        title: z.string().trim().min(1, "Informe o título.").max(160),
        body: bodyText,
      })
      .and(term)
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [c] = await tx.select().from(contracts).where(eq(contracts.id, input.id)).for("update");
      if (!c || c.revision !== input.revision) throw Error("stale");
      // In review, the team edits the next version while the client reads the sent one.
      if (c.status !== "draft" && c.status !== "in_review")
        throw Error("Só rascunhos podem ser editados. Volte o contrato para rascunho ou crie um aditivo.");
      await tx
        .update(contracts)
        .set({
          title: input.title,
          body: input.body,
          startsAt: input.startsAt || null,
          endsAt: input.endsAt || null,
          revision: c.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, c.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.draft_updated",
      });
    });
    refresh(input.id);
    return { success: "Rascunho salvo." };
  } catch (e) {
    return failure(e);
  }
}

/**
 * The validity dates after the text is frozen. They drive the expiry alerts;
 * what binds the parties is the signed text, so this never touches it.
 */
export async function setContractTerm(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ id }).and(term).parse(Object.fromEntries(form));
    const [c] = await db.select().from(contracts).where(eq(contracts.id, input.id));
    if (!c) return blocked;
    if (c.status === "cancelled") return { error: "Contrato cancelado não tem vigência." };
    const endsAt = input.endsAt || null;
    const changedEnd = endsAt !== c.endsAt;
    await db
      .update(contracts)
      .set({
        startsAt: input.startsAt || null,
        endsAt,
        ...(changedEnd ? { expiryNoticeSentAt: null, expiredNoticeSentAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, c.id));
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: c.companyId,
      entityId: c.id,
      action: "contract.term_updated",
      details: { startsAt: input.startsAt || null, endsAt },
    });
    refresh(c.id, c.parentId);
    return { success: "Vigência atualizada." };
  } catch (e) {
    return failure(e);
  }
}

/** Who at the company may sign: active members with finance permission. */
async function companySigners(companyId: string) {
  return db
    .select({ email: memberships.email, name: user.name })
    .from(memberships)
    .leftJoin(
      accountEmails,
      and(eq(accountEmails.email, memberships.email), isNotNull(accountEmails.verifiedAt)),
    )
    .leftJoin(user, or(eq(user.email, memberships.email), eq(user.id, accountEmails.userId)))
    .where(and(eq(memberships.companyId, companyId), eq(memberships.active, true), eq(memberships.role, "manager")));
}

/** Freezes the text as a new version, hashes it and asks the client to sign. */
export async function sendContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const contractId = id.parse(form.get("id"));
    const sent = await db.transaction(async (tx) => {
      const [c] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).for("update");
      if (!c) throw Error("Contrato não encontrado.");
      if (c.status !== "draft" && c.status !== "in_review") throw Error("Este contrato já foi enviado.");
      // A legal text never goes out with an open {{field}} in it.
      const open = pendingContractVariables(c.body);
      if (open.length)
        throw Error(
          `O texto salvo ainda tem ${open.length === 1 ? "o campo" : `${open.length} campos`} ${open.slice(0, 3).join(", ")}${open.length > 3 ? "…" : ""}. Preencha ou remova em Campos do contrato e salve antes de enviar.`,
        );
      // The client gets an answer to every request with the new version.
      const [{ pending }] = await tx
        .select({ pending: count() })
        .from(contractChangeRequests)
        .where(and(eq(contractChangeRequests.contractId, c.id), eq(contractChangeRequests.status, "pending")));
      if (pending)
        throw Error(
          pending === 1
            ? "Responda o pedido de alteração do cliente antes de enviar a nova versão."
            : `Responda os ${pending} pedidos de alteração do cliente antes de enviar a nova versão.`,
        );
      const [{ answered }] = await tx
        .select({ answered: count() })
        .from(contractChangeRequests)
        .where(
          and(
            eq(contractChangeRequests.contractId, c.id),
            eq(contractChangeRequests.version, c.publishedVersion),
            ne(contractChangeRequests.status, "draft"),
          ),
        );
      const [company] = await tx.select().from(companies).where(eq(companies.id, c.companyId));
      const parent = c.parentId
        ? (await tx.select({ title: contracts.title, hash: contracts.documentHash }).from(contracts).where(eq(contracts.id, c.parentId)))[0]
        : null;
      const publication: ContractPublication = {
        title: c.title,
        body: c.body,
        companyName: company.name,
        companyDocument: company.document,
        kind: c.kind,
        parentTitle: parent?.title ?? null,
        parentHash: parent?.hash ?? null,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        version: c.publishedVersion + 1,
      };
      const documentHash = hashOf(publication);
      const version = c.publishedVersion + 1;
      await tx
        .update(contracts)
        .set({
          status: "sent",
          publication,
          publishedAt: new Date(),
          publishedVersion: version,
          documentHash,
          revision: c.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, c.id));
      await tx.insert(contractVersions).values({
        contractId: c.id,
        version,
        title: c.title,
        body: c.body,
        documentHash,
        sentBy: actor.user.id,
      });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.sent",
        details: { hash: documentHash, version },
      });
      return { ...c, version, companyName: company.name, answered: c.status === "in_review" ? answered : 0 };
    });
    const url = `${process.env.BETTER_AUTH_URL || "http://localhost:3100"}/contratos/${sent.id}`;
    // No Administrador yet: the person the team named gets access now that the contract is out, so the notice reaches them.
    const invite = await inviteManagerOnSend(form, sent.companyId);
    const signers = await companySigners(sent.companyId);
    let notified = 0;
    for (const signer of signers) {
      try {
        await deliverContractNotice(signer.email, {
          companyName: sent.companyName,
          title: sent.title,
          url,
          kind: sent.kind,
          version: sent.version,
          answered: sent.answered,
        });
        notified += 1;
      } catch {
        /* The contract is out; the client can still open it in the Console. */
      }
    }
    refresh(sent.id, sent.parentId);
    const noun = sent.kind === "amendment" ? "Aditivo" : "Contrato";
    return {
      success:
        (notified
          ? `${noun} enviado. ${notified === 1 ? "1 pessoa avisada" : `${notified} pessoas avisadas`} por e-mail.`
          : `${noun} enviado. Ninguém da empresa é Administrador para receber o aviso; libere o acesso em Empresas.`) + (invite ? ` ${invite}` : ""),
    };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Reopens a sent contract for editing. The version that went out stays on
 * record, and any signature it received stays tied to that version's hash;
 * the next send is a new version that both parties sign again.
 */
export async function revertContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const contractId = id.parse(form.get("id"));
    const reverted = await db.transaction(async (tx) => {
      const [c] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).for("update");
      if (!c) throw Error("Contrato não encontrado.");
      if (c.status !== "sent") throw Error("Só um contrato aguardando assinatura volta para rascunho.");
      // The client stops seeing it; requests they had not sent have nothing to answer.
      await tx
        .delete(contractChangeRequests)
        .where(and(eq(contractChangeRequests.contractId, c.id), eq(contractChangeRequests.status, "draft")));
      const [signed] = await tx
        .select({ n: count() })
        .from(contractSignatures)
        .where(and(eq(contractSignatures.contractId, c.id), eq(contractSignatures.documentHash, c.documentHash!)));
      await tx
        .update(contracts)
        .set({
          status: "draft",
          publication: null,
          documentHash: null,
          publishedAt: null,
          revision: c.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, c.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.reverted",
        details: { version: c.publishedVersion, signaturesVoided: signed.n },
      });
      return { parentId: c.parentId, signaturesVoided: signed.n };
    });
    refresh(contractId, reverted.parentId);
    return {
      success: reverted.signaturesVoided
        ? "Voltou para rascunho. A assinatura dada na versão anterior fica no histórico e a nova versão precisa ser assinada de novo."
        : "Voltou para rascunho. O próximo envio cria uma nova versão.",
    };
  } catch (e) {
    return failure(e);
  }
}

/** Which side of the table the viewer sits on, for this contract. */
function partyFor(actor: Actor, companyId: string): "anuntech" | "client" | null {
  if (actor.admin) return "anuntech";
  const grant = actor.grants.find((g) => g.company.id === companyId);
  return grant && hasPermission(grant.role, "finance") ? "client" : null;
}

/**
 * Records the viewer's signature with the evidence behind it. When both
 * parties have signed the current version, the contract closes and the
 * final PDF is stored. A signed amendment that carries new dates moves
 * the original contract's validity, so the alerts follow the amendment.
 */
export async function signContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const contractId = id.parse(form.get("id"));
    if (form.get("consent") !== "on" && form.get("consent") !== "yes")
      return { error: "Marque que leu e concorda com o contrato para assinar." };
    const [c] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    if (!c || !canAccess(actor, c.companyId, "finance")) return blocked;
    const party = partyFor(actor, c.companyId);
    if (!party) return { error: "Só um Administrador da empresa pode assinar." };
    if (c.status !== "sent" || !c.publication || !c.documentHash)
      return { error: "Este contrato não está aguardando assinatura." };
    if (!hashMatches(c.publication, c.documentHash))
      return { error: "O texto do contrato não confere com o registro. Peça um novo envio." };
    const [session, requestHeaders] = await Promise.all([
      auth.api.getSession({ headers: await headers() }),
      headers(),
    ]);
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip") ||
      null;
    const closed = await db.transaction(async (tx) => {
      const current = and(eq(contractSignatures.contractId, c.id), eq(contractSignatures.documentHash, c.documentHash!));
      const [existing] = await tx
        .select({ id: contractSignatures.id })
        .from(contractSignatures)
        .where(and(current, eq(contractSignatures.party, party)));
      if (existing) throw Error("Esta parte já assinou o contrato.");
      await tx.insert(contractSignatures).values({
        contractId: c.id,
        party,
        userId: actor.user.id,
        // A person who never set a name still signs identifiably, by the e-mail they logged in with.
        name: actor.user.name || actor.user.email,
        email: actor.user.email,
        documentHash: c.documentHash!,
        ip,
        userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
        method: "otp_session",
        sessionStartedAt: session ? new Date(session.session.createdAt) : null,
      });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.signed",
        details: { party, ip, version: c.publishedVersion },
      });
      // Signing settles it: change requests the client wrote but never sent go away.
      if (party === "client")
        await tx
          .delete(contractChangeRequests)
          .where(and(eq(contractChangeRequests.contractId, c.id), eq(contractChangeRequests.status, "draft")));
      const signatures = await tx
        .select()
        .from(contractSignatures)
        .where(current)
        .orderBy(asc(contractSignatures.signedAt));
      const complete = ["client", "anuntech"].every((p) => signatures.some((s) => s.party === p));
      if (!complete) return false;
      const pdf = await contractPdf({
        ...c.publication!,
        id: c.id,
        status: "signed",
        date: new Date(),
        hash: c.documentHash!,
        signatures: signatures.map((s) => ({
          party: s.party,
          name: s.name,
          email: s.email,
          signedAt: s.signedAt,
          ip: s.ip,
          method: s.method,
        })),
      });
      await tx
        .update(contracts)
        .set({ status: "signed", signedAt: new Date(), signedPdf: pdf, updatedAt: new Date() })
        .where(eq(contracts.id, c.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.completed",
      });
      if (c.kind === "amendment" && c.parentId && (c.startsAt || c.endsAt)) {
        await tx
          .update(contracts)
          .set({
            ...(c.startsAt ? { startsAt: c.startsAt } : {}),
            ...(c.endsAt ? { endsAt: c.endsAt, expiryNoticeSentAt: null, expiredNoticeSentAt: null } : {}),
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, c.parentId));
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: c.companyId,
          entityId: c.parentId,
          action: "contract.term_amended",
          details: { amendmentId: c.id, startsAt: c.startsAt, endsAt: c.endsAt },
        });
      }
      return true;
    });
    refresh(c.id, c.parentId);
    const noun = c.kind === "amendment" ? "Aditivo" : "Contrato";
    // Both sides signed: the client gets the final PDF's link and the next steps (Configurações → Automações).
    if (closed) after(() => deliverContractSigned(c.id).catch(() => undefined));
    // The client signed first: the team hears it now, so the contract closes the same day.
    if (!closed && party === "client") {
      const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, c.companyId));
      await sendOpsMail(
        `[Console] ${noun} assinado pelo cliente: falta a Anuntech · ${company?.name ?? ""}`,
        `${actor.user.name || actor.user.email} assinou "${c.title}" por ${company?.name ?? "o cliente"} em ${longDateLabel(new Date())}.\n\nFalta a assinatura da Anuntech. Assine pelo Console: ${process.env.BETTER_AUTH_URL || "http://localhost:3100"}/contratos/${c.id}\n\nConsole da Anuntech`,
      );
    }
    return {
      success: closed
        ? `${noun} assinado pelas duas partes. O PDF final já está disponível.`
        : party === "client"
          ? "Sua assinatura foi registrada. Falta a assinatura da Anuntech."
          : "Sua assinatura foi registrada. Falta a assinatura do cliente.",
    };
  } catch (e) {
    return failure(e);
  }
}

/** A draft or a sent contract can be withdrawn; signed ones stay as they are. */
export async function cancelContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const contractId = id.parse(form.get("id"));
    const [c] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    if (!c) return blocked;
    if (c.status === "signed") return { error: "Um contrato assinado não pode ser cancelado por aqui; registre a rescisão por aditivo." };
    if (c.status === "cancelled") return { error: "Este contrato já está cancelado." };
    await db
      .update(contracts)
      .set({ status: "cancelled", revision: c.revision + 1, updatedAt: new Date() })
      .where(eq(contracts.id, c.id));
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: c.companyId,
      entityId: c.id,
      action: "contract.cancelled",
    });
    refresh(c.id, c.parentId);
    return { success: c.kind === "amendment" ? "Aditivo cancelado." : "Contrato cancelado." };
  } catch (e) {
    return failure(e);
  }
}
