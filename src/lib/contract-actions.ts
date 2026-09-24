"use server";
import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "./db";
import { getActor, canAccess, type Actor } from "./access";
import { auth } from "./auth";
import {
  accountEmails,
  auditEvents,
  catalogItems,
  companies,
  contractSignatures,
  contractTemplates,
  contracts,
  engagements,
  environmentProfile,
  memberships,
  subscriptions,
  user,
} from "@/db/schema";
import type { ActionState } from "./action-state";
import { addressLabel } from "./company-billing";
import { formatDocument } from "./company-input";
import { contractPdf } from "./contract-pdf";
import { deliverContractNotice } from "./contract-mail";
import { fillContractTemplate } from "./contract-templates";
import { currency } from "./format";
import { hasPermission } from "./permissions";

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para realizar esta ação." };
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
function refresh(contractId?: string) {
  revalidatePath("/contratos");
  revalidatePath("/configuracoes/contratos");
  if (contractId) revalidatePath(`/contratos/${contractId}`);
}
const hashOf = (publication: { title: string; body: string; companyName: string; companyDocument: string }) =>
  createHash("sha256")
    .update(JSON.stringify(publication))
    .digest("hex");

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
async function contractValues(companyId: string, engagementId: string | null) {
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
      data: new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date()),
      anuntech: anuntech?.name ?? "",
      anuntech_cnpj: anuntech ? formatDocument(anuntech.document) : "",
      anuntech_endereco: anuntech?.billingAddress ? addressLabel(anuntech.billingAddress) : "",
    },
  };
}

/** A draft from a template (or blank), with the company's data filled in. */
export async function createContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        companyId: id,
        templateId: z.union([id, z.literal("")]).default(""),
        engagementId: z.union([id, z.literal("")]).default(""),
        title: z.string().trim().max(160).default(""),
      })
      .parse(Object.fromEntries(form));
    const template = input.templateId
      ? (
          await db
            .select()
            .from(contractTemplates)
            .where(and(eq(contractTemplates.id, input.templateId), eq(contractTemplates.active, true)))
        )[0]
      : null;
    if (input.templateId && !template) return { error: "Escolha um modelo ativo." };
    const { company, values } = await contractValues(input.companyId, input.engagementId || null);
    const title = input.title || (template ? `${template.name} — ${company.name}` : `Contrato — ${company.name}`);
    const body = template ? fillContractTemplate(template.body, values) : "";
    const [row] = await db
      .insert(contracts)
      .values({
        companyId: company.id,
        templateId: template?.id ?? null,
        engagementId: input.engagementId || null,
        title,
        body: body || "Escreva o contrato.",
        authorId: actor.user.id,
      })
      .returning({ id: contracts.id });
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: company.id,
      entityId: row.id,
      action: "contract.created",
      details: { templateId: template?.id ?? null },
    });
    refresh(row.id);
    return { success: "Rascunho criado. Revise o texto e envie para assinatura.", href: `/contratos/${row.id}` };
  } catch (e) {
    return failure(e);
  }
}

/** Title and text of a draft; the revision guards against edits in another tab. */
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
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [c] = await tx.select().from(contracts).where(eq(contracts.id, input.id)).for("update");
      if (!c || c.revision !== input.revision) throw Error("stale");
      if (c.status !== "draft") throw Error("Só rascunhos podem ser editados. Cancele e crie outro contrato.");
      await tx
        .update(contracts)
        .set({ title: input.title, body: input.body, revision: c.revision + 1, updatedAt: new Date() })
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

/** Freezes the text, hashes it and asks the client to sign. */
export async function sendContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const contractId = id.parse(form.get("id"));
    const sent = await db.transaction(async (tx) => {
      const [c] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).for("update");
      if (!c) throw Error("Contrato não encontrado.");
      if (c.status !== "draft") throw Error("Este contrato já foi enviado.");
      const [company] = await tx.select().from(companies).where(eq(companies.id, c.companyId));
      const publication = {
        title: c.title,
        body: c.body,
        companyName: company.name,
        companyDocument: company.document,
      };
      const documentHash = hashOf(publication);
      await tx
        .update(contracts)
        .set({
          status: "sent",
          publication,
          publishedAt: new Date(),
          publishedVersion: c.publishedVersion + 1,
          documentHash,
          revision: c.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, c.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.sent",
        details: { hash: documentHash },
      });
      return { ...c, companyName: company.name };
    });
    const url = `${process.env.BETTER_AUTH_URL || "http://localhost:3100"}/contratos/${sent.id}`;
    const signers = await companySigners(sent.companyId);
    let notified = 0;
    for (const signer of signers) {
      try {
        await deliverContractNotice(signer.email, { companyName: sent.companyName, title: sent.title, url });
        notified += 1;
      } catch {
        /* The contract is out; the client can still open it in the Console. */
      }
    }
    refresh(sent.id);
    return {
      success: notified
        ? `Contrato enviado. ${notified === 1 ? "1 pessoa avisada" : `${notified} pessoas avisadas`} por e-mail.`
        : "Contrato enviado. Ninguém da empresa tem acesso de gestor para avisar; libere o acesso em Empresas.",
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
 * parties have signed, the contract closes and the final PDF is stored.
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
    if (!party) return { error: "Só gestores da empresa podem assinar." };
    if (c.status !== "sent" || !c.publication || !c.documentHash)
      return { error: "Este contrato não está aguardando assinatura." };
    if (hashOf(c.publication) !== c.documentHash)
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
      const [existing] = await tx
        .select({ id: contractSignatures.id })
        .from(contractSignatures)
        .where(and(eq(contractSignatures.contractId, c.id), eq(contractSignatures.party, party)));
      if (existing) throw Error("Esta parte já assinou o contrato.");
      await tx.insert(contractSignatures).values({
        contractId: c.id,
        party,
        userId: actor.user.id,
        name: actor.user.name,
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
        details: { party, ip },
      });
      const signatures = await tx
        .select()
        .from(contractSignatures)
        .where(eq(contractSignatures.contractId, c.id))
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
      return true;
    });
    refresh(c.id);
    return {
      success: closed
        ? "Contrato assinado pelas duas partes. O PDF final já está disponível."
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
    if (c.status === "signed") return { error: "Um contrato assinado não pode ser cancelado por aqui." };
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
    refresh(c.id);
    return { success: "Contrato cancelado." };
  } catch (e) {
    return failure(e);
  }
}

/** Companies whose managers still have not signed, for lists and reminders. */
export async function contractsAwaiting(companyIds: string[]) {
  if (!companyIds.length) return [];
  return db
    .select({ id: contracts.id, companyId: contracts.companyId })
    .from(contracts)
    .where(and(inArray(contracts.companyId, companyIds), eq(contracts.status, "sent")));
}
