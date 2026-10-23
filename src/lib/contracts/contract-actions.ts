"use server";
import { and, count, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { getActor } from "../access/access";
import { requestEvidence, type DecisionEvidence } from "../access/client-decision";
import {
  accountEmails,
  auditEvents,
  catalogItems,
  companies,
  automationEvents,
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
import { contractFailure as failure, refreshContracts as refresh } from "./contract-common";
import { contractHash as hashOf } from "./contract-hash";
import { signContractAs } from "./contract-sign";
import { addressLabel } from "../companies/company-billing";
import { formatDocument } from "../companies/company-input";
import { deliverContractNotice } from "./contract-mail";
import { notifiedLabel, RESEND_TOO_SOON, sentMomentsAgo } from "../notifications/resend-guard";
import { enqueuePush, schedulePushNotices } from "../notifications/push-queue";
import { inviteManagerOnSend } from "../access/invite-manager";
import { fillContractTemplate, pendingContractVariables } from "./contract-templates";
import { applyContractFields, contractFields } from "./contract-fields";
import { quoteContractValues } from "../quotes/quote-handoff";
import { readjustFor } from "./readjust";
import { currency, longDateLabel } from "../format";

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

/** The yearly readjust by IPCA; the clause waits for the lawyer, so the team reviews it before sending. */
const READJUST_SKELETON = [
  "TERMO ADITIVO DE REAJUSTE",
  "CONTRATANTE: {{empresa}}, CNPJ {{cnpj}}.\nCONTRATADA: {{anuntech}}, CNPJ {{anuntech_cnpj}}.",
  "As partes acima resolvem aditar o contrato “{{contrato}}”, assinado em {{contrato_data}}, nos seguintes termos:",
  "CLÁUSULA 1 — REAJUSTE\nA partir de {{aniversario}}, o valor {{objeto_reajuste}}, de {{valor_atual}}, passa a {{novo_valor}}, corrigido pelo IPCA acumulado de {{periodo}} ({{percentual}}).",
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
        readjust: z.literal("yes").optional(),
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
    // The readjust is computed again here (IPCA, the item's price): the form only asks for it.
    const readjust = parent && input.readjust ? await readjustFor(parent.id) : null;
    if (parent && input.readjust && !readjust) return { error: "Este contrato não tem reajuste a preparar agora (aniversário em até 30 dias, item com preço e IPCA disponível)." };
    let body = template
      ? fillContractTemplate(template.body, values)
      : parent
        ? fillContractTemplate(readjust ? READJUST_SKELETON : input.renewal ? RENEWAL_SKELETON : AMENDMENT_SKELETON, values)
        : "";
    if (readjust)
      body = applyContractFields(body, {
        valor_atual: currency(readjust.currentCents),
        novo_valor: currency(readjust.newCents),
        percentual: `${String(readjust.percent).replace(".", ",")}%`,
        periodo: readjust.period,
        aniversario: longDateLabel(readjust.anniversary),
        objeto_reajuste: `${readjust.cycle ? `${readjust.cycle} ` : ""}de ${readjust.item}`,
      }).body;
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
        // A readjust changes the price, never the term: signing it must not move the contract's dates.
        startsAt: readjust ? null : input.startsAt || null,
        endsAt: readjust ? null : input.endsAt || null,
        authorId: actor.user.id,
        quoteId: quote?.id ?? null,
      })
      .returning({ id: contracts.id });
    // This anniversary's readjust is prepared: it leaves the lists (an amendment cancelled later brings it back).
    if (readjust && parent)
      await db
        .insert(automationEvents)
        .values({ kind: "contract.readjust", entityId: `${parent.id}:${readjust.anniversary}`, companyId: company.id, actorId: actor.user.id, details: { amendmentId: row.id, percent: readjust.percent, newCents: readjust.newCents } })
        .onConflictDoUpdate({ target: [automationEvents.kind, automationEvents.entityId], set: { details: { amendmentId: row.id, percent: readjust.percent, newCents: readjust.newCents }, createdAt: new Date() } });
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
      // The Administradores' phones: they are the ones who sign.
      await enqueuePush(tx, {
        event: "contract.sent",
        eventKey: `contract.sent:${c.id}:${version}`,
        companyId: c.companyId,
        entityId: c.id,
        actorId: actor.user.id,
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
    schedulePushNotices();
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

/** Sends the "contract awaits your signature" e-mail again to the Administradores, while the client has not signed. */
export async function resendContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const contractId = id.parse(form.get("id"));
    const [c] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    if (!c) throw Error("Contrato não encontrado.");
    if (c.status !== "sent" || !c.documentHash) throw Error("Só um contrato aguardando assinatura tem aviso para reenviar.");
    const [{ signed }] = await db
      .select({ signed: count() })
      .from(contractSignatures)
      .where(and(eq(contractSignatures.contractId, c.id), eq(contractSignatures.documentHash, c.documentHash), eq(contractSignatures.party, "client")));
    if (signed) throw Error("O cliente já assinou esta versão.");
    if (await sentMomentsAgo(c.id, ["contract.sent", "contract.notice_resent"])) throw Error(RESEND_TOO_SOON);
    const signers = await companySigners(c.companyId);
    if (!signers.length) throw Error("Ninguém da empresa é Administrador para receber o aviso. Libere o acesso em Empresas.");
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, c.companyId));
    const url = `${process.env.BETTER_AUTH_URL || "http://localhost:3100"}/contratos/${c.id}`;
    let notified = 0;
    for (const signer of signers) {
      try {
        await deliverContractNotice(signer.email, { companyName: company.name, title: c.title, url, kind: c.kind, version: c.publishedVersion });
        notified += 1;
      } catch {
        /* One address failing does not stop the others. */
      }
    }
    if (!notified) throw Error("O e-mail não saiu. Tente de novo em alguns minutos.");
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: c.companyId,
      entityId: c.id,
      action: "contract.notice_resent",
      details: { version: c.publishedVersion, notified },
    });
    refresh(c.id, c.parentId);
    return { success: `E-mail reenviado para ${notifiedLabel(notified)}.` };
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

/**
 * Records the viewer's signature (the rules, evidence and side effects are
 * in signContractAs, shared with the app's contracts.sign). The evidence is
 * this request's IP and user agent and when its session was opened.
 */
export async function signContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  let contractId: string;
  let evidence: DecisionEvidence;
  try {
    contractId = id.parse(form.get("id"));
    evidence = await requestEvidence();
  } catch (e) {
    return failure(e);
  }
  const consent = form.get("consent") === "on" || form.get("consent") === "yes";
  const result = await signContractAs(actor, { id: contractId, consent }, evidence);
  return "error" in result ? { error: result.error } : { success: result.success };
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
    // Only from the status read above: a signature that closes the contract meanwhile wins, and this stops.
    const [cancelled] = await db
      .update(contracts)
      .set({ status: "cancelled", revision: c.revision + 1, updatedAt: new Date() })
      .where(and(eq(contracts.id, c.id), eq(contracts.status, c.status)))
      .returning({ id: contracts.id });
    if (!cancelled) throw Error("stale");
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
