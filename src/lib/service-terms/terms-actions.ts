"use server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, companies, contractTemplates, contracts, engagements, serviceTerms } from "@/db/schema";
import { synovaWithoutTerms } from "./terms-queries";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { blankPolicy, presetForTemplate, presetPolicy, termsPresets } from "./presets";
import { BUSINESS_DAY_MINUTES, type ServicePolicy } from "./terms-model";
import { moneyToCents } from "../access/permissions";

/*
 * The team records a company's "Condições de atendimento" from its signed
 * contract. Only verified conditions (someone confirmed them against the
 * text) govern tickets; clients see them from `publishAt`.
 */

const blocked = { error: "Você não tem permissão para fazer isso." };
const id = z.string().uuid();
/** Hours as typed ("4", "1,5", "18"), stored as minutes; empty means none. */
const hours = z
  .string()
  .default("")
  .transform((v, ctx) => {
    const text = v.trim().replace(",", ".");
    if (!text) return null;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0 || value > 2000) {
      ctx.addIssue({ code: "custom", message: "Informe as horas como 4 ou 1,5." });
      return z.NEVER;
    }
    return Math.round(value * 60);
  });
const days = z
  .string()
  .default("")
  .transform((v, ctx) => {
    if (!v.trim()) return null;
    const value = Number(v.trim());
    if (!Number.isInteger(value) || value < 0 || value > 365) {
      ctx.addIssue({ code: "custom", message: "Informe os dias como um número inteiro." });
      return z.NEVER;
    }
    return value;
  });
const clause = z.string().trim().max(60, "Cláusula com até 60 caracteres.").default("");
const flag = z
  .union([z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === "on");

const input = z.object({
  id: z.union([id, z.literal("")]).default(""),
  companyId: id,
  engagementId: z.union([id, z.literal("")]).default(""),
  basis: z.enum(["console_contract", "external_contract", "none"]),
  preset: z.string().refine((v) => termsPresets.some((p) => p.key === v), "Escolha um modelo."),
  label: z.string().trim().min(2, "Dê um nome às condições.").max(80),
  contractId: z.union([id, z.literal("")]).default(""),
  levels: flag,
  criticalResponse: hours,
  criticalGoal: hours,
  highResponse: hours,
  highGoal: hours,
  normalResponse: hours,
  normalGoal: hours,
  outageResponse: hours,
  responseClause: clause,
  pausesWhileWaiting: flag,
  pauseClause: clause,
  clientResponseDays: days,
  clientResponseClause: clause,
  testDays: days,
  tacitAcceptance: flag,
  testClause: clause,
  bankHours: hours,
  /** Price of each hour beyond the bank (SUP 3.3), as typed ("150" or "150,00"); empty: not agreed. */
  overage: z
    .string()
    .default("")
    .transform((v, ctx) => {
      const text = v.trim().replace(/^R\$\s*/, "");
      if (!text) return null;
      const cents = moneyToCents(text.includes(",") ? text.replace(/\./g, "") : text);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Informe o valor da hora excedente como 150 ou 150,00." });
        return z.NEVER;
      }
      return cents;
    }),
  bankAlertPercent: days,
  reportContestDays: days,
  bankClause: clause,
  improvementBankLimit: hours,
  improvementWarrantyDays: days,
  improvementClause: clause,
  outOfHours: z.enum(["not_included", "if_contracted", "unspecified"]).default("unspecified"),
  outOfHoursClause: clause,
  includesDevelopment: flag,
  suspensionDays: days,
  suspensionNotice: flag,
  suspensionClause: clause,
  warrantyUntil: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(""),
  personClient: flag,
  publishAt: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(""),
  verified: flag,
});

function policyFrom(v: z.infer<typeof input>): ServicePolicy {
  if (v.basis === "none") return blankPolicy();
  const base = presetPolicy(v.preset) ?? blankPolicy();
  const rule = (response: number | null, goal: number | null) => (response ? { firstResponseMinutes: response, goalMinutes: goal } : undefined);
  const response = v.levels
    ? { critical: rule(v.criticalResponse, v.criticalGoal), high: rule(v.highResponse, v.highGoal), normal: rule(v.normalResponse, v.normalGoal) }
    : { normal: rule(v.normalResponse, v.normalGoal) };
  const clauses: Record<string, string> = { ...base.clauses };
  const set = (key: string, value: string) => {
    if (value) clauses[key] = value;
  };
  set("response", v.responseClause);
  set("pausesWhileWaiting", v.pauseClause);
  set("clientResponseDays", v.clientResponseClause);
  set("testDays", v.testClause);
  set("tacitAcceptance", v.testClause);
  set("hoursBank", v.bankClause);
  set("reportContestDays", v.bankClause);
  set("improvementBankLimitMinutes", v.improvementClause);
  set("improvementWarrantyDays", v.improvementClause);
  set("outOfHours", v.outOfHoursClause);
  set("suspension", v.suspensionClause);
  return {
    ...base,
    levels: v.levels,
    response: Object.fromEntries(Object.entries(response).filter(([, r]) => r)),
    outageFirstResponseMinutes: v.levels ? null : v.outageResponse,
    pausesWhileWaiting: v.pausesWhileWaiting,
    clientResponseDays: v.clientResponseDays,
    testDays: v.testDays,
    tacitAcceptance: v.tacitAcceptance,
    hoursBank: v.bankHours
      ? { monthlyMinutes: v.bankHours, alertPercent: v.bankAlertPercent ?? 80, overageCents: v.overage, reportContestDays: v.reportContestDays }
      : null,
    improvementBankLimitMinutes: v.improvementBankLimit,
    improvementWarrantyDays: v.improvementWarrantyDays,
    outOfHours: v.outOfHours,
    includesDevelopment: v.includesDevelopment,
    suspensionDays: v.suspensionDays,
    suspensionNotice: v.suspensionNotice,
    warrantyUntil: v.warrantyUntil || null,
    clauses,
  };
}

/** Creates or edits a company's conditions; editing makes a new version (open tickets keep the one they started with). */
export async function saveServiceTerms(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const v = input.parse(Object.fromEntries(form));
    const policy = policyFrom(v);
    if (v.basis !== "none" && !policy.response.normal && !policy.response.high && !policy.response.critical)
      return { error: "Informe a primeira resposta em horas úteis, ou escolha Sem contrato." };
    if (v.basis !== "none" && Object.values(policy.response).some((r) => r && !Number.isFinite(r.firstResponseMinutes)))
      return { error: "Confira as horas da primeira resposta." };
    if (v.basis !== "none" && !Object.keys(policy.clauses).length)
      return { error: "Informe a cláusula de onde vêm os prazos." };
    if (v.engagementId) {
      const [eng] = await db
        .select({ id: engagements.id })
        .from(engagements)
        .where(and(eq(engagements.id, v.engagementId), eq(engagements.companyId, v.companyId)));
      if (!eng) return blocked;
    }
    if (v.contractId) {
      const [contract] = await db
        .select({ id: contracts.id })
        .from(contracts)
        .where(and(eq(contracts.id, v.contractId), eq(contracts.companyId, v.companyId)));
      if (!contract) return blocked;
    }
    const now = new Date();
    const values = {
      companyId: v.companyId,
      engagementId: v.engagementId || null,
      basis: v.basis,
      preset: v.basis === "none" ? "custom" : v.preset,
      label: v.label,
      contractId: v.contractId || null,
      policy,
      personClient: v.personClient,
      // Noon in São Paulo on the chosen day, so the date never slips across midnight.
      publishAt: v.publishAt ? new Date(`${v.publishAt}T12:00:00-03:00`) : null,
      verifiedBy: v.verified ? actor.user.id : null,
      verifiedAt: v.verified ? now : null,
      updatedAt: now,
    };
    await db.transaction(async (tx) => {
      let termsId = v.id;
      if (v.id) {
        const [current] = await tx
          .select({ version: serviceTerms.version })
          .from(serviceTerms)
          .where(and(eq(serviceTerms.id, v.id), eq(serviceTerms.companyId, v.companyId)))
          .for("update");
        if (!current) throw Error("Condições não encontradas.");
        await tx.update(serviceTerms).set({ ...values, version: current.version + 1 }).where(eq(serviceTerms.id, v.id));
      } else {
        const [row] = await tx.insert(serviceTerms).values(values).returning({ id: serviceTerms.id });
        termsId = row.id;
      }
      // One set of conditions in force per scope: once conferred, it replaces the
      // others. A draft waits beside the record in force until it is conferred.
      if (v.verified)
        await tx
          .update(serviceTerms)
          .set({ active: false, updatedAt: now })
          .where(
            and(
              eq(serviceTerms.companyId, v.companyId),
              eq(serviceTerms.active, true),
              ne(serviceTerms.id, termsId!),
              v.engagementId ? eq(serviceTerms.engagementId, v.engagementId) : isNull(serviceTerms.engagementId),
            ),
          );
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: v.companyId,
        action: v.id ? "service_terms.updated" : "service_terms.created",
        entityId: termsId,
        details: { label: v.label, basis: v.basis, preset: v.preset, verified: v.verified, firstResponseDays: (policy.response.normal?.firstResponseMinutes ?? 0) / BUSINESS_DAY_MINUTES },
      });
    });
    revalidatePath(`/empresas/${v.companyId}`);
    revalidatePath("/como-trabalhamos");
    return { success: v.verified ? "Condições salvas e conferidas." : "Condições salvas como rascunho. Elas só valem depois de conferidas com o contrato." };
  } catch (e) {
    if (logDatabaseFault("service terms", e)) return { error: DATABASE_FAILURE };
    return { error: e instanceof z.ZodError ? e.issues[0].message : e instanceof Error && e.message ? e.message : "Não foi possível salvar." };
  }
}

/** Stops conditions from governing new tickets; open tickets keep their deadlines. */
export async function deactivateServiceTerms(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const termsId = id.safeParse(form.get("id"));
  if (!termsId.success) return blocked;
  const [row] = await db
    .update(serviceTerms)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(serviceTerms.id, termsId.data))
    .returning({ companyId: serviceTerms.companyId, label: serviceTerms.label });
  if (!row) return blocked;
  await db.insert(auditEvents).values({
    actorId: actor.user.id,
    companyId: row.companyId,
    action: "service_terms.deactivated",
    entityId: termsId.data,
    details: { label: row.label },
  });
  revalidatePath(`/empresas/${row.companyId}`);
  return { success: "Condições desativadas. Novos chamados ficam sem prazo até outras entrarem." };
}

/**
 * Draft conditions from a signed contract: the ficha of its template, the
 * contract and its item linked, unconfirmed and unpublished. Only confirmed
 * conditions govern tickets, so nothing changes for the client until
 * someone checks them against the signed text.
 */
export async function prepareServiceTerms(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const contractId = id.safeParse(form.get("contractId"));
  if (!contractId.success) return blocked;
  try {
    const [row] = await db
      .select({ contract: contracts, template: contractTemplates.name, document: companies.document })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .leftJoin(contractTemplates, eq(contractTemplates.id, contracts.templateId))
      .where(eq(contracts.id, contractId.data));
    if (!row || row.contract.status !== "signed" || row.contract.kind !== "contract") return { error: "Só um contrato assinado gera condições." };
    const preset = presetForTemplate(row.template);
    const policy = preset ? presetPolicy(preset) : null;
    if (!preset || !policy) return { error: "Este modelo de contrato não tem ficha de condições. Cadastre à mão na página da empresa." };
    const [existing] = await db.select({ id: serviceTerms.id }).from(serviceTerms).where(eq(serviceTerms.contractId, row.contract.id));
    if (existing) return { error: "Este contrato já tem condições. Confira na página da empresa." };
    const [terms] = await db
      .insert(serviceTerms)
      .values({
        companyId: row.contract.companyId,
        engagementId: row.contract.engagementId,
        basis: "console_contract",
        preset,
        label: termsPresets.find((p) => p.key === preset)!.label,
        contractId: row.contract.id,
        policy,
        personClient: row.document.replace(/\D/g, "").length === 11,
      })
      .returning({ id: serviceTerms.id });
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: row.contract.companyId,
      action: "service_terms.created",
      entityId: terms.id,
      details: { preset, contractId: row.contract.id, verified: false, prepared: true },
    });
    revalidatePath(`/empresas/${row.contract.companyId}`);
    revalidatePath(`/contratos/${row.contract.id}`);
    return {
      success: "Condições criadas como rascunho. Confira com o contrato assinado antes de valerem.",
      href: `/empresas/${row.contract.companyId}`,
    };
  } catch (e) {
    if (logDatabaseFault("service terms", e)) return { error: DATABASE_FAILURE };
    return { error: e instanceof Error && e.message ? e.message : "Não foi possível preparar as condições." };
  }
}

/** One draft per Synova client without conditions (external contract, Synova ficha), all unconfirmed. */
export async function prepareSynovaTerms(): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const rows = await synovaWithoutTerms();
    const policy = presetPolicy("synova")!;
    for (const row of rows) {
      const [terms] = await db
        .insert(serviceTerms)
        .values({
          companyId: row.companyId,
          basis: "external_contract",
          preset: "synova",
          label: "Licença Synova",
          policy,
          personClient: row.document.replace(/\D/g, "").length === 11,
        })
        .returning({ id: serviceTerms.id });
      await db.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "service_terms.created",
        entityId: terms.id,
        details: { preset: "synova", verified: false, prepared: true },
      });
      revalidatePath(`/empresas/${row.companyId}`);
    }
    revalidatePath("/configuracoes/contratos");
    return rows.length
      ? { success: `${rows.length === 1 ? "1 rascunho criado" : `${rows.length} rascunhos criados`}. Confira cada um na página da empresa.` }
      : { success: "Todos os clientes do Synova já têm condições." };
  } catch (e) {
    if (logDatabaseFault("service terms", e)) return { error: DATABASE_FAILURE };
    return { error: e instanceof Error && e.message ? e.message : "Não foi possível preparar as condições." };
  }
}
